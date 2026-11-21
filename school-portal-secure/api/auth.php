<?php
declare(strict_types=1);
require __DIR__.'/bootstrap.php';
$action=$_GET['action']??'';
if($action==='csrf') respond(['csrf'=>csrf_token()]);
if($action==='me') respond(['user'=>user(),'csrf'=>csrf_token()]);
if($action==='register') {
 require_method('POST'); csrf_check(); $v=json_input();
 $name=trim((string)($v['name']??'')); $email=strtolower(trim((string)($v['email']??''))); $lrn=trim((string)($v['lrn']??''));
 $grade=$v['grade']??''; $section=trim((string)($v['section']??'')); $strand=trim((string)($v['strand']??'')); $password=(string)($v['password']??'');
 if(mb_strlen($name)<3||mb_strlen($name)>150||!filter_var($email,FILTER_VALIDATE_EMAIL)||!preg_match('/^[0-9]{12}$/',$lrn)||!in_array($grade,['Grade 11','Grade 12'],true)||$section===''||$strand===''||strlen($password)<10) respond(['error'=>'Check all fields. Password must be at least 10 characters.'],422);
 try {
  $s=$pdo->prepare("INSERT INTO users(full_name,email,lrn,grade_level,section,strand,password_hash,role,account_status) VALUES(?,?,?,?,?,?,?,'student','pending') RETURNING id");
  $s->execute([$name,$email,$lrn,$grade,$section,$strand,password_hash($password,PASSWORD_DEFAULT)]); $id=(int)$s->fetchColumn();
  audit($pdo,$id,'Student registration submitted','user',$id); respond(['message'=>'Registration submitted. Wait for school personnel approval.'],201);
 } catch(PDOException $e) { if($e->getCode()==='23505') respond(['error'=>'Email or LRN is already registered.'],409); throw $e; }
}
if($action==='login') {
 require_method('POST'); csrf_check(); $v=json_input(); $email=strtolower(trim((string)($v['email']??''))); $password=(string)($v['password']??'');
 if(!filter_var($email,FILTER_VALIDATE_EMAIL)||$password==='') respond(['error'=>'Enter a valid email and password.'],422);
 $ip=$_SERVER['REMOTE_ADDR']??null;
 $q=$pdo->prepare("SELECT COUNT(*) FROM login_attempts WHERE (email=? OR ip_address IS NOT DISTINCT FROM CAST(? AS INET)) AND attempted_at > (NOW() - INTERVAL '15 minutes')");
 $q->execute([$email,$ip ?: null]); if((int)$q->fetchColumn()>=8) respond(['error'=>'Too many sign-in attempts. Try again in 15 minutes.'],429);
 $q=$pdo->prepare('SELECT id,full_name,email,password_hash,role,account_status FROM users WHERE email=? LIMIT 1'); $q->execute([$email]); $u=$q->fetch();
 if(!$u||!password_verify($password,$u['password_hash'])) {
  $a=$pdo->prepare('INSERT INTO login_attempts(email,ip_address) VALUES(?,CAST(? AS INET))'); $a->execute([$email,$ip ?: null]); respond(['error'=>'Invalid email or password.'],401);
 }
 if($u['account_status']!=='approved') respond(['error'=>$u['account_status']==='pending'?'Your account is awaiting school personnel approval.':'This account is not active.'],403);
 if(password_needs_rehash($u['password_hash'],PASSWORD_DEFAULT)) { $h=$pdo->prepare('UPDATE users SET password_hash=? WHERE id=?'); $h->execute([password_hash($password,PASSWORD_DEFAULT),$u['id']]); }
 $pdo->prepare('DELETE FROM login_attempts WHERE email=?')->execute([$email]);
 session_regenerate_id(true); $_SESSION['user']=['id'=>(int)$u['id'],'name'=>$u['full_name'],'email'=>$u['email'],'role'=>$u['role']]; $_SESSION['csrf']=bin2hex(random_bytes(32));
 audit($pdo,(int)$u['id'],'Signed in'); respond(['user'=>$_SESSION['user'],'csrf'=>$_SESSION['csrf']]);
}
if($action==='logout') {
 require_method('POST'); csrf_check(); if($u=user()) audit($pdo,(int)$u['id'],'Signed out');
 $_SESSION=[]; if(ini_get('session.use_cookies')) { $p=session_get_cookie_params(); setcookie(session_name(),'',time()-42000,$p['path'],$p['domain']??'',$p['secure'],$p['httponly']); }
 session_destroy(); respond(['message'=>'Signed out']);
}
if($action==='forgot-password') {
 require_method('POST'); csrf_check(); $v=json_input(); $email=strtolower(trim((string)($v['email']??'')));
 if(!filter_var($email,FILTER_VALIDATE_EMAIL)) respond(['error'=>'Enter a valid registered email address.'],422);
 $q=$pdo->prepare('SELECT id,full_name,email,account_status FROM users WHERE email=? LIMIT 1'); $q->execute([$email]); $target=$q->fetch();
 $generic='If an active account matches that email, password reset instructions have been issued.';
 if(!$target||$target['account_status']!=='approved') respond(['message'=>$generic]);
 $raw=bin2hex(random_bytes(24)); $hash=hash('sha256',$raw);
 $pdo->prepare('DELETE FROM password_resets WHERE user_id=? OR expires_at<NOW()')->execute([$target['id']]);
 $ins=$pdo->prepare("INSERT INTO password_resets(user_id,token_hash,expires_at) VALUES(?,?,NOW()+INTERVAL '30 minutes')"); $ins->execute([$target['id'],$hash]);
 $base=rtrim((string)$config['app']['base_url'],'/'); $link=($base?$base.'/':'').'?reset_token='.$raw;
 $sent=send_portal_email($target['email'],$target['full_name'],'Password Reset Request',"Hello {$target['full_name']},\n\nUse this token within 30 minutes:\n{$raw}\n\n{$link}\n\nIgnore this message if you did not request it.");
 audit($pdo,(int)$target['id'],'Requested password reset','user',(int)$target['id']);
 $response=['message'=>$generic]; if(!$sent && ($config['app']['environment']??'production')!=='production') $response['dev_reset_token']=$raw;
 respond($response);
}
if($action==='reset-password') {
 require_method('POST'); csrf_check(); $v=json_input(); $token=trim((string)($v['token']??'')); $new=(string)($v['password']??'');
 if($token===''||strlen($new)<10) respond(['error'=>'Valid reset token and a new password of at least 10 characters are required.'],422);
 $q=$pdo->prepare("SELECT pr.id,pr.user_id,u.role FROM password_resets pr JOIN users u ON u.id=pr.user_id WHERE pr.token_hash=? AND pr.used_at IS NULL AND pr.expires_at>NOW() LIMIT 1");
 $q->execute([hash('sha256',$token)]); $row=$q->fetch(); if(!$row) respond(['error'=>'Invalid or expired password reset token.'],422);
 if(in_array($row['role'],['admin','superadmin'],true)&&strlen($new)<12) respond(['error'=>'Administrator passwords must be at least 12 characters.'],422);
 $pdo->beginTransaction();
 try {
  $pdo->prepare('UPDATE users SET password_hash=? WHERE id=?')->execute([password_hash($new,PASSWORD_DEFAULT),$row['user_id']]);
  $pdo->prepare('UPDATE password_resets SET used_at=NOW() WHERE id=?')->execute([$row['id']]);
  audit($pdo,(int)$row['user_id'],'Completed password reset','user',(int)$row['user_id']); $pdo->commit();
 } catch(Throwable $e) { $pdo->rollBack(); throw $e; }
 respond(['message'=>'Password updated successfully. You may now sign in.']);
}
if($action==='change-password') {
 require_method('POST'); csrf_check(); $u=require_auth(); $v=json_input(); $cur=(string)($v['current_password']??''); $new=(string)($v['new_password']??'');
 $min=in_array($u['role'],['admin','superadmin'],true)?12:10; if(strlen($new)<$min) respond(['error'=>"New password must be at least {$min} characters."],422);
 $q=$pdo->prepare('SELECT password_hash FROM users WHERE id=? LIMIT 1'); $q->execute([$u['id']]); $row=$q->fetch();
 if(!$row||!password_verify($cur,$row['password_hash'])) respond(['error'=>'Current password is incorrect.'],401);
 $pdo->prepare('UPDATE users SET password_hash=? WHERE id=?')->execute([password_hash($new,PASSWORD_DEFAULT),$u['id']]);
 audit($pdo,(int)$u['id'],'Changed account password','user',(int)$u['id']); respond(['message'=>'Password changed successfully.']);
}
respond(['error'=>'Unknown auth action'],404);
