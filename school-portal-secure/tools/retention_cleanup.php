<?php
declare(strict_types=1);
$config=require __DIR__.'/../config/config.php';
if(PHP_SAPI!=='cli') {
 $secret=$_GET['secret']??$_POST['secret']??''; $expected=$config['retention']['cron_secret']??'';
 if($expected===''||!hash_equals($expected,(string)$secret)){http_response_code(403);header('Content-Type: application/json');echo json_encode(['error'=>'Unauthorized maintenance trigger']);exit;}
}
$d=$config['db'];
$pdo=new PDO("pgsql:host={$d['host']};port={$d['port']};dbname={$d['name']};sslmode={$d['sslmode']}",$d['user'],$d['pass'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$login=(int)$config['retention']['login_attempt_minutes']; $archive=(int)$config['retention']['archive_logs_days']; $notif=(int)$config['retention']['purge_read_notifications_days'];
$pdo->beginTransaction();
try {
 $q=$pdo->prepare("DELETE FROM login_attempts WHERE attempted_at < NOW()-make_interval(mins => CAST(? AS integer))"); $q->execute([$login]); $attempts=$q->rowCount();
 $resets=$pdo->query("DELETE FROM password_resets WHERE expires_at<NOW() OR used_at IS NOT NULL")->rowCount();
 $q=$pdo->prepare("INSERT INTO archived_activity_logs(id,actor_id,action,target_type,target_id,ip_address,created_at) SELECT id,actor_id,action,target_type,target_id,ip_address,created_at FROM activity_logs WHERE created_at<NOW()-make_interval(days => CAST(? AS integer)) ON CONFLICT(id) DO NOTHING");
 $q->execute([$archive]); $archived=$q->rowCount();
 $q=$pdo->prepare("DELETE FROM activity_logs WHERE created_at<NOW()-make_interval(days => CAST(? AS integer))"); $q->execute([$archive]);
 $q=$pdo->prepare("DELETE FROM notifications WHERE is_read=TRUE AND created_at<NOW()-make_interval(days => CAST(? AS integer))"); $q->execute([$notif]); $notifications=$q->rowCount();
 $pdo->commit();
 $result=['status'=>'ok','executed_at'=>date('c'),'purged_login_attempts'=>$attempts,'purged_reset_tokens'=>$resets,'archived_activity_logs'=>$archived,'purged_read_notifications'=>$notifications];
} catch(Throwable $e){$pdo->rollBack();error_log($e->getMessage());http_response_code(500);$result=['status'=>'error','message'=>'Retention cleanup failed'];}
header('Content-Type: application/json'); echo json_encode($result,JSON_PRETTY_PRINT);
