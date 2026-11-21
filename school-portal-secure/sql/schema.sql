CREATE DATABASE IF NOT EXISTS school_project_portal CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE school_project_portal;

CREATE TABLE users (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  lrn CHAR(12) NULL UNIQUE,
  grade_level ENUM('Grade 11','Grade 12') NULL,
  section VARCHAR(80) NULL,
  strand VARCHAR(80) NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('student','admin','superadmin') NOT NULL DEFAULT 'student',
  account_status ENUM('pending','approved','rejected','disabled') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_users_role_status (role, account_status)
) ENGINE=InnoDB;

CREATE TABLE projects (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  category VARCHAR(100) NULL,
  description TEXT NOT NULL,
  eligibility_requirements TEXT NOT NULL,
  required_documents TEXT NULL,
  total_slots INT UNSIGNED NOT NULL DEFAULT 0,
  deadline DATE NULL,
  status ENUM('draft','published','closed') NOT NULL DEFAULT 'draft',
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_projects_creator FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE applications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  student_id BIGINT UNSIGNED NOT NULL,
  project_id BIGINT UNSIGNED NOT NULL,
  reason TEXT NOT NULL,
  additional_notes TEXT NULL,
  status ENUM('Pending','Approved','Rejected','Needs information') NOT NULL DEFAULT 'Pending',
  review_note TEXT NULL,
  reviewed_by BIGINT UNSIGNED NULL,
  submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP NULL,
  CONSTRAINT fk_app_student FOREIGN KEY (student_id) REFERENCES users(id),
  CONSTRAINT fk_app_project FOREIGN KEY (project_id) REFERENCES projects(id),
  CONSTRAINT fk_app_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_app_project_status (project_id,status),
  INDEX idx_app_student_status (student_id,status)
) ENGINE=InnoDB;

CREATE TABLE application_documents (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  application_id BIGINT UNSIGNED NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  stored_name CHAR(64) NOT NULL UNIQUE,
  mime_type VARCHAR(100) NOT NULL,
  file_size INT UNSIGNED NOT NULL,
  uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_document_application FOREIGN KEY (application_id) REFERENCES applications(id) ON DELETE CASCADE,
  INDEX idx_documents_application (application_id)
) ENGINE=InnoDB;

-- Only one active/pending application per student per project.
CREATE TABLE notifications (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(180) NOT NULL,
  message TEXT NOT NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_notifications_user_read (user_id,is_read,created_at)
) ENGINE=InnoDB;

CREATE TABLE activity_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_id BIGINT UNSIGNED NULL,
  action VARCHAR(255) NOT NULL,
  target_type VARCHAR(60) NULL,
  target_id BIGINT UNSIGNED NULL,
  ip_address VARBINARY(16) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_log_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_logs_created (created_at)
) ENGINE=InnoDB;

CREATE TABLE login_attempts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL,
  ip_address VARBINARY(16) NULL,
  attempted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_login_attempts (email,attempted_at),
  INDEX idx_login_ip (ip_address,attempted_at)
) ENGINE=InnoDB;

-- Seed projects only. Create administrator accounts using tools/create_admin.php.
INSERT INTO projects (name,category,description,eligibility_requirements,required_documents,total_slots,deadline,status) VALUES
('Project Pedal','Student Assistance','A bicycle assistance program to help eligible students with transportation to and from school.','Currently enrolled student; demonstrate transportation need; submit the required supporting documents.','Proof of enrollment; application form',12,'2026-12-15','published'),
('Project Linaw','Health & Wellness','Vision and eyeglasses assistance for students who meet the program criteria.','Currently enrolled student; vision concern confirmed through screening; meet program eligibility criteria.','Proof of enrollment; vision screening result',20,'2026-12-20','published'),
('Project Finance','Financial Assistance','Financial assistance for eligible students based on the school assessment criteria.','Currently enrolled student; meet the published household-income and assessment requirements.','Proof of enrollment; household income documents',8,'2026-12-10','published'),
('Project Uniform','Student Assistance','Uniform assistance for eligible students.','Currently enrolled student; demonstrate need and meet school criteria.','Proof of enrollment; application form',15,NULL,'published');

CREATE TABLE IF NOT EXISTS password_resets (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  token_hash CHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reset_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_reset_token (token_hash),
  INDEX idx_reset_expires (expires_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS archived_activity_logs (
  id BIGINT UNSIGNED PRIMARY KEY,
  actor_id BIGINT UNSIGNED NULL,
  action VARCHAR(255) NOT NULL,
  target_type VARCHAR(60) NULL,
  target_id BIGINT UNSIGNED NULL,
  ip_address VARBINARY(16) NULL,
  created_at TIMESTAMP NOT NULL,
  archived_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
