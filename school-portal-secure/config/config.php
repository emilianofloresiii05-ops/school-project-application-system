<?php
declare(strict_types=1);
$get = static fn(string $key, string $default = ''): string => (string)(getenv($key) !== false ? getenv($key) : $default);
return [
 'db' => [
   'host' => $get('DB_HOST'),
   'port' => $get('DB_PORT','5432'),
   'name' => $get('DB_NAME'),
   'user' => $get('DB_USER'),
   'pass' => $get('DB_PASSWORD'),
   'sslmode' => $get('DB_SSLMODE','require')
 ],
 'app' => [
   'school_id' => $get('SCHOOL_ID','342566'),
   'session_name' => 'SJLSHS_PORTAL',
   'base_url' => rtrim($get('APP_BASE_URL'),'/'),
   'environment' => $get('APP_ENV','production'),
   'upload_dir' => $get('UPLOAD_DIR', dirname(__DIR__).'/private_uploads')
 ],
 'mail' => [
   'enabled' => filter_var($get('MAIL_ENABLED','false'), FILTER_VALIDATE_BOOLEAN),
   'from_email' => $get('MAIL_FROM_EMAIL','noreply@example.com'),
   'from_name' => $get('MAIL_FROM_NAME','School Project Portal')
 ],
 'retention' => [
   'login_attempt_minutes' => 15,
   'archive_logs_days' => 180,
   'purge_read_notifications_days' => 90,
   'cron_secret' => $get('RETENTION_CRON_SECRET')
 ]
];
