<?php
require __DIR__.'/bootstrap.php';$u=require_role(['admin','superadmin']);
if($_SERVER['REQUEST_METHOD']==='GET'){
 [$page,$limit,$offset]=paginate_params(25,100);
 $where=[]; $params=[];
 if($u['role']!=='superadmin'){ $where[]="role='student'"; }
 $status=trim((string)($_GET['status']??'')); if($status!=='' && $status!=='all'){ $where[]='account_status=?'; $params[]=$status; }
 $q=trim((string)($_GET['q']??'')); if($q!==''){ $where[]='(full_name LIKE ? OR email LIKE ? OR lrn LIKE ?)'; $like="%{$q}%"; array_push($params,$like,$like,$like); }
 $whereSql=$where?('WHERE '.implode(' AND ',$where)):'';
 $c=$pdo->prepare("SELECT COUNT(*) FROM users {$whereSql}"); $c->execute($params); $total=(int)$c->fetchColumn();
 $s=$pdo->prepare("SELECT id,full_name,email,lrn,grade_level,section,strand,role,account_status,created_at FROM users {$whereSql} ORDER BY created_at DESC LIMIT {$limit} OFFSET {$offset}");
 $s->execute($params);
 respond(['users'=>$s->fetchAll(),'pagination'=>['page'=>$page,'limit'=>$limit,'total'=>$total,'total_pages'=>max(1,(int)ceil($total/$limit))]]);
}
require_method('POST');csrf_check();$v=json_input();$id=(int)($v['id']??0);$action=$v['action']??'';
if($action==='set-status'&&$id){$status=$v['status']??'';if(!in_array($status,['approved','rejected','disabled'],true))respond(['error'=>'Invalid account status'],422);$s=$pdo->prepare("UPDATE users SET account_status=? WHERE id=? AND role='student'");$s->execute([$status,$id]);notify_and_email($pdo,$id,'Student account '.$status,'Your student portal account status is now: '.$status.'.');audit($pdo,$u['id'],'Changed student account status to '.$status,'user',$id);respond(['message'=>'Account status updated']);}
if($u['role']!=='superadmin')respond(['error'=>'Only the Super Admin can manage privileged accounts.'],403);
if($action==='create-admin'){$name=trim((string)($v['name']??''));$email=strtolower(trim((string)($v['email']??'')));$pass=(string)($v['password']??'');$role=$v['role']??'admin';if($name===''||!filter_var($email,FILTER_VALIDATE_EMAIL)||strlen($pass)<12||!in_array($role,['admin','superadmin'],true))respond(['error'=>'Name, valid email, 12-character password and valid role are required.'],422);try{$s=$pdo->prepare("INSERT INTO users(full_name,email,password_hash,role,account_status) VALUES(?,?,?,?,'approved') RETURNING id");$s->execute([$name,$email,password_hash($pass,PASSWORD_DEFAULT),$role]);$new=(int)$s->fetchColumn();audit($pdo,$u['id'],'Created '.$role.' account','user',$new);respond(['message'=>'Administrator created','id'=>$new],201);}catch(PDOException $e){if($e->getCode()==='23505')respond(['error'=>'Email already exists'],409);throw $e;}}
respond(['error'=>'Unknown account action'],404);
