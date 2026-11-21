<?php
require __DIR__.'/bootstrap.php';$u=require_auth();
if($_SERVER['REQUEST_METHOD']==='GET'){$s=$pdo->prepare('SELECT id,title,message,is_read,created_at FROM notifications WHERE user_id=? ORDER BY created_at DESC');$s->execute([$u['id']]);respond(['notifications'=>$s->fetchAll()]);}
require_method('POST');csrf_check();$v=json_input();$id=(int)($v['id']??0);if($id){$s=$pdo->prepare('UPDATE notifications SET is_read=TRUE WHERE id=? AND user_id=?');$s->execute([$id,$u['id']]);}else{$s=$pdo->prepare('UPDATE notifications SET is_read=TRUE WHERE user_id=?');$s->execute([$u['id']]);}respond(['message'=>'Notifications updated']);
