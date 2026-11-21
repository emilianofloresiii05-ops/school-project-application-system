NEON + RENDER: READ NEON-RENDER-DEPLOYMENT.txt FIRST.

SAN JOSE-LITEX SHS ONLINE STUDENT PROJECT APPLICATION SYSTEM
School ID: 342566

IMPORTANT STATUS
This package contains your existing HTML/CSS/JavaScript prototype plus a secure PHP/MySQL backend foundation, database schema, and API endpoints. The existing script.js still uses localStorage and is NOT yet wired to these APIs. Do not use the frontend with real student records until its data operations have been migrated to the API. The backend files are a foundation, not a claim that the entire existing interface is already database-connected.

TECHNOLOGY
Frontend: HTML + CSS + JavaScript
Backend: PHP 8.1+ (PDO)
Database: MySQL 8.0+
Recommended local environment: XAMPP (Apache, PHP, MySQL)

INSTALLATION (XAMPP)
1. Install/start Apache and MySQL in XAMPP.
2. Copy this folder into C:\xampp\htdocs\school-portal-secure.
3. Open phpMyAdmin at http://localhost/phpmyadmin.
4. Import sql/schema.sql. It creates database school_project_portal and starter project records.
5. Copy config/config.example.php to config/config.php.
6. Create a MySQL user specifically for this application. Grant only SELECT, INSERT, UPDATE, DELETE on school_project_portal.*. Do not use the MySQL root account in the deployed application.
7. Put that database username/password in config/config.php. Never upload config.php to a public repository.
8. Create the first administrator from a terminal in this folder:
   php tools/create_admin.php
   Use a unique email and a long, unique password. Do not use demo passwords.
9. Open http://localhost/school-portal-secure/ in your browser. The current UI remains a prototype until API integration is completed.

API ROUTES
GET  api/auth.php?action=csrf       Get CSRF token
GET  api/auth.php?action=me         Current session and CSRF token
POST api/auth.php?action=register   Student registration
POST api/auth.php?action=login      Sign in by email/password
POST api/auth.php?action=logout     Sign out
GET  api/projects.php               Public published projects; admins see all
POST api/projects.php               Admin create/update project
GET  api/applications.php           Student's own apps; admin list
GET  api/applications.php?project_id=ID  Applicants for one project (admin only)
POST api/applications.php           Submit or review application
GET  api/notifications.php          Current user's notifications
POST api/notifications.php          Mark notification(s) read
GET  api/admin-users.php            Admin user list
POST api/admin-users.php            Superadmin approval/status/admin provisioning

SECURITY INCLUDED IN BACKEND
- PDO prepared statements and native prepares
- password_hash/password_verify (no plaintext passwords)
- PHP server-side session; HttpOnly, SameSite=Strict cookie; session ID rotation
- CSRF token checks on state-changing endpoints
- role checks on admin-only operations
- login throttling based on email/IP over a 15-minute window
- server-side validation and escaping-safe JSON responses
- database transactions and row locks when approving applications
- checks preventing one student from receiving multiple project approvals
- project slot enforcement under transaction/row lock
- activity log and user-scoped notifications

BEFORE REAL DEPLOYMENT
- Serve only over HTTPS; set secure cookies in production.
- Put config.php outside the public web root if your hosting permits, or deny web access to config/ and tools/ using server configuration.
- Add a password reset/change workflow and enforce strong passwords.
- Add a backup and restore procedure; encrypt and restrict backup access.
- Set a retention policy and privacy notice consistent with the Data Privacy Act of 2012 and school policy.
- Do not collect sensitive documents until secure upload validation, private storage, access controls, and malware scanning are implemented.
- Have your school ICT coordinator review and test the deployment.
- The API assumes the website and API are served from the same origin. Do not enable permissive CORS.

FRONTEND MIGRATION STILL REQUIRED
The current script.js reads/writes a localStorage object called activeProjectsPortal_v1. For production, replace those operations with fetch() calls to the API. In particular, migrate login/register, projects, application submission/list/review, notifications, account approvals, and activity logs. Keep authorization checks on the server; hiding buttons in JavaScript is not security.


DOCUMENT REQUIREMENT UPLOADS
- The application form now has a multiple-file picker (PDF, JPG, PNG; up to 5 files, 5 MB each). In the current localStorage prototype, it only previews selected filenames; it does not persist file contents.
- The secure backend now includes api/documents.php and the application_documents table (included in sql/schema.sql). It stores files in private_uploads/ with randomized filenames, checks actual MIME type and size, and restricts downloads to the applicant or authorized administrators.
- To enable real uploads, finish migrating the application form to the PHP API: submit the application, obtain its returned application ID, then POST multipart/form-data to api/documents.php with application_id and documents[] plus the session CSRF token in X-CSRF-Token. Do not expose the private_uploads directory.
- PHP upload_max_filesize and post_max_size must be configured to allow the chosen limit. Enable HTTPS before production use.
