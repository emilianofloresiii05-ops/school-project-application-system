<?php
declare(strict_types=1);
$config = require __DIR__ . '/../config/config.php';
$d = $config['db'];
foreach (['host','name','user','pass'] as $key) {
 if (($d[$key] ?? '') === '') { http_response_code(500); header('Content-Type: application/json'); echo json_encode(['error'=>'Database environment variables are incomplete.']); exit; }
}
$secure = ((!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https'));
session_name($config['app']['session_name'] ?? 'SJLSHS_PORTAL');
session_set_cookie_params(['lifetime'=>0,'path'=>'/','secure'=>$secure,'httponly'=>true,'samesite'=>'Lax']);
ini_set('session.use_strict_mode','1');
session_start();
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Cache-Control: no-store');
header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
try {
 $dsn = "pgsql:host={$d['host']};port=".($d['port'] ?: '5432').";dbname={$d['name']};sslmode=".($d['sslmode'] ?: 'require');
 $pdo = new PDO($dsn,$d['user'],$d['pass'],[
  PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,
  PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC,
  PDO::ATTR_EMULATE_PREPARES=>false
 ]);
} catch(Throwable $e) {
 error_log('Database connection error: '.$e->getMessage());
 http_response_code(500); echo json_encode(['error'=>'Database connection failed. Check Render database environment variables.']); exit;
}
function json_input(): array { $v=json_decode(file_get_contents('php://input'),true); return is_array($v)?$v:$_POST; }
function respond(array $data,int $status=200): never { http_response_code($status); echo json_encode($data,JSON_UNESCAPED_UNICODE|JSON_INVALID_UTF8_SUBSTITUTE); exit; }
function require_method(string $method): void { if(($_SERVER['REQUEST_METHOD']??'GET')!==$method) respond(['error'=>'Method not allowed'],405); }
function user(): ?array { return $_SESSION['user']??null; }
function require_auth(): array { $u=user(); if(!$u) respond(['error'=>'Authentication required'],401); return $u; }
function require_role(array $roles): array { $u=require_auth(); if(!in_array($u['role'],$roles,true)) respond(['error'=>'You are not authorized to perform this action'],403); return $u; }
function csrf_check(): void { $token=$_SERVER['HTTP_X_CSRF_TOKEN']??''; if(!$token || !hash_equals($_SESSION['csrf']??'', $token)) respond(['error'=>'Invalid security token. Refresh and try again.'],419); }
function csrf_token(): string { if(empty($_SESSION['csrf'])) $_SESSION['csrf']=bin2hex(random_bytes(32)); return $_SESSION['csrf']; }
function audit(PDO $pdo,?int $actor,string $action,?string $type=null,?int $id=null): void {
 $ip=$_SERVER['REMOTE_ADDR']??null;
 $stmt=$pdo->prepare('INSERT INTO activity_logs(actor_id,action,target_type,target_id,ip_address) VALUES(?,?,?,?,CAST(? AS INET))');
 $stmt->execute([$actor,$action,$type,$id,$ip ?: null]);
}
function notify_user(PDO $pdo,int $uid,string $title,string $message): void {
 $s=$pdo->prepare('INSERT INTO notifications(user_id,title,message) VALUES(?,?,?)'); $s->execute([$uid,$title,$message]);
}
function send_portal_email(string $toEmail,string $toName,string $subject,string $bodyText): bool {
 global $config;
 if (empty($config['mail']['enabled']) || !filter_var($toEmail,FILTER_VALIDATE_EMAIL)) return false;
 $fromEmail=$config['mail']['from_email']; $fromName=$config['mail']['from_name'];
 $headers=['MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','From: '.mb_encode_mimeheader($fromName,'UTF-8')." <{$fromEmail}>",'Reply-To: '.$fromEmail];
 return @mail($toEmail,mb_encode_mimeheader($subject,'UTF-8'),$bodyText,implode("\r\n",$headers));
}
function notify_and_email(PDO $pdo,int $uid,string $title,string $message): void {
 notify_user($pdo,$uid,$title,$message);
 $q=$pdo->prepare('SELECT full_name,email FROM users WHERE id=? LIMIT 1'); $q->execute([$uid]);
 if($row=$q->fetch()) send_portal_email((string)$row['email'],(string)$row['full_name'],'[SJLSHS Portal] '.$title,"Hello {$row['full_name']},\n\n{$message}\n\n— School Project Portal");
}
function paginate_params(int $defaultLimit=20,int $maxLimit=100): array {
 $page=max(1,(int)($_GET['page']??1)); $limit=min($maxLimit,max(1,(int)($_GET['limit']??$defaultLimit))); return [$page,$limit,($page-1)*$limit];
}
