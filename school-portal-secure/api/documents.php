<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';
$u = require_auth();
$storage = $config['app']['upload_dir'] ?? (dirname(__DIR__) . '/private_uploads');
if (!is_dir($storage) && !mkdir($storage, 0700, true) && !is_dir($storage)) {
  respond(['error' => 'Private document storage is unavailable.'], 500);
}

// Download: only the applicant and authorized administrators may access a document.
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['download'])) {
  $id = filter_var($_GET['download'], FILTER_VALIDATE_INT);
  if (!$id) respond(['error' => 'Invalid document.'], 422);
  $q = $pdo->prepare('SELECT d.*, a.student_id FROM application_documents d JOIN applications a ON a.id=d.application_id WHERE d.id=?');
  $q->execute([$id]); $doc = $q->fetch();
  if (!$doc) respond(['error' => 'Document not found.'], 404);
  if ($u['role'] === 'student' && (int)$doc['student_id'] !== (int)$u['id']) respond(['error' => 'Not authorized.'], 403);
  $path = $storage . DIRECTORY_SEPARATOR . $doc['stored_name'];
  if (!is_file($path)) respond(['error' => 'Stored document is unavailable.'], 404);
  header_remove('Content-Type');
  header('Content-Type: ' . $doc['mime_type']);
  header('Content-Length: ' . filesize($path));
  header('Content-Disposition: attachment; filename="' . rawurlencode($doc['original_name']) . '"');
  header('Cache-Control: private, no-store');
  readfile($path); exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
  $applicationId = filter_var($_GET['application_id'] ?? null, FILTER_VALIDATE_INT);
  if (!$applicationId) respond(['error' => 'Application ID is required.'], 422);
  $a = $pdo->prepare('SELECT student_id FROM applications WHERE id=?');
  $a->execute([$applicationId]); $owner = $a->fetch();
  if (!$owner) respond(['error' => 'Application not found.'], 404);
  if ($u['role'] === 'student' && (int)$owner['student_id'] !== (int)$u['id']) respond(['error' => 'Not authorized.'], 403);
  $q = $pdo->prepare('SELECT id, application_id, original_name, mime_type, file_size, uploaded_at FROM application_documents WHERE application_id=? ORDER BY uploaded_at');
  $q->execute([$applicationId]); respond(['documents' => $q->fetchAll()]);
}

require_method('POST'); csrf_check();
$applicationId = filter_var($_POST['application_id'] ?? null, FILTER_VALIDATE_INT);
if (!$applicationId || empty($_FILES['documents'])) respond(['error' => 'Application and document files are required.'], 422);
$a = $pdo->prepare('SELECT student_id, status FROM applications WHERE id=?');
$a->execute([$applicationId]); $app = $a->fetch();
if (!$app) respond(['error' => 'Application not found.'], 404);
if ($u['role'] !== 'student' || (int)$app['student_id'] !== (int)$u['id']) respond(['error' => 'Only the applicant can upload documents to this application.'], 403);
if (!in_array($app['status'], ['Pending', 'Needs information'], true)) respond(['error' => 'Documents cannot be added to this application in its current status.'], 409);
$files = $_FILES['documents'];
$names = is_array($files['name']) ? $files['name'] : [$files['name']];
$tmp = is_array($files['tmp_name']) ? $files['tmp_name'] : [$files['tmp_name']];
$errors = is_array($files['error']) ? $files['error'] : [$files['error']];
$sizes = is_array($files['size']) ? $files['size'] : [$files['size']];
if (count($names) < 1 || count($names) > 5) respond(['error' => 'Upload between 1 and 5 files at a time.'], 422);
$finfo = new finfo(FILEINFO_MIME_TYPE);
$allowed = ['application/pdf' => 'pdf', 'image/jpeg' => 'jpg', 'image/png' => 'png'];
$saved = [];
try {
  foreach ($names as $i => $original) {
    if ($errors[$i] !== UPLOAD_ERR_OK || $sizes[$i] < 1 || $sizes[$i] > 5 * 1024 * 1024 || !is_uploaded_file($tmp[$i])) throw new RuntimeException('Each file must be valid and no larger than 5 MB.');
    $mime = $finfo->file($tmp[$i]);
    if (!isset($allowed[$mime])) throw new RuntimeException('Only PDF, JPG, and PNG files are accepted.');
    $stored = bin2hex(random_bytes(32));
    $destination = $storage . DIRECTORY_SEPARATOR . $stored;
    if (!move_uploaded_file($tmp[$i], $destination)) throw new RuntimeException('A file could not be stored.');
    $saved[] = $destination;
    $ins = $pdo->prepare('INSERT INTO application_documents(application_id, original_name, stored_name, mime_type, file_size) VALUES(?,?,?,?,?)');
    $safeName = preg_replace('/[^A-Za-z0-9._ -]/u', '_', basename((string)$original));
    $ins->execute([$applicationId, mb_substr($safeName ?: 'document', 0, 255), $stored, $mime, (int)$sizes[$i]]);
  }
  audit($pdo, (int)$u['id'], 'Uploaded application documents', 'application', (int)$applicationId);
  respond(['message' => 'Documents uploaded securely.']);
} catch (Throwable $e) {
  foreach ($saved as $file) if (is_file($file)) @unlink($file);
  if ($e instanceof RuntimeException) respond(['error' => $e->getMessage()], 422);
  throw $e;
}
