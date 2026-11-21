<?php
require __DIR__.'/bootstrap.php'; $u=require_auth();
if($_SERVER['REQUEST_METHOD']==='GET') {
 $projectId=isset($_GET['project_id'])?(int)$_GET['project_id']:0;
 $statusFilter=trim((string)($_GET['status']??''));
 $search=trim((string)($_GET['q']??''));
 [$page,$limit,$offset]=paginate_params(25,100);
 $where=[]; $params=[];
 if($u['role']==='student'){ $where[]='a.student_id=?'; $params[]=$u['id']; }
 elseif($projectId){ $where[]='a.project_id=?'; $params[]=$projectId; }
 if($statusFilter!=='' && $statusFilter!=='all'){ $where[]='a.status=?'; $params[]=$statusFilter; }
 if($search!==''){ $where[]='(s.full_name LIKE ? OR p.name LIKE ? OR s.lrn LIKE ?)'; $like="%{$search}%"; array_push($params,$like,$like,$like); }
 $whereSql=$where?('WHERE '.implode(' AND ',$where)):'';
 $countStmt=$pdo->prepare("SELECT COUNT(*) FROM applications a JOIN projects p ON p.id=a.project_id JOIN users s ON s.id=a.student_id {$whereSql}");
 $countStmt->execute($params); $total=(int)$countStmt->fetchColumn();
 $sql="SELECT a.*,p.name project_name,s.full_name student_name,s.email student_email,s.lrn,s.grade_level,s.section,s.strand,r.full_name reviewer_name
       FROM applications a JOIN projects p ON p.id=a.project_id JOIN users s ON s.id=a.student_id LEFT JOIN users r ON r.id=a.reviewed_by
       {$whereSql} ORDER BY a.submitted_at DESC LIMIT {$limit} OFFSET {$offset}";
 $s=$pdo->prepare($sql); $s->execute($params);
 respond(['applications'=>$s->fetchAll(),'pagination'=>['page'=>$page,'limit'=>$limit,'total'=>$total,'total_pages'=>max(1,(int)ceil($total/$limit))]]);
}
require_method('POST'); csrf_check(); $v=json_input();
if(($v['action']??'')==='submit') {
 if($u['role']!=='student') respond(['error'=>'Only students can submit applications.'],403);
 $pid=(int)($v['project_id']??0);$reason=trim((string)($v['reason']??''));$notes=trim((string)($v['notes']??''));if($pid<1||mb_strlen($reason)<10)respond(['error'=>'Select a project and provide an application statement of at least 10 characters.'],422);
 try{$pdo->beginTransaction();
  $lock=$pdo->prepare('SELECT id FROM users WHERE id=? FOR UPDATE');$lock->execute([$u['id']]);
  $p=$pdo->prepare('SELECT * FROM projects WHERE id=? FOR UPDATE');$p->execute([$pid]);$project=$p->fetch();if(!$project||$project['status']!=='published'||($project['deadline']&&$project['deadline']<date('Y-m-d')))throw new RuntimeException('This project is not accepting applications.');
  $x=$pdo->prepare("SELECT COUNT(*) FROM applications WHERE student_id=? AND status='Approved'");$x->execute([$u['id']]);if((int)$x->fetchColumn()>0)throw new RuntimeException('You are already approved for a project.');
  $x=$pdo->prepare("SELECT COUNT(*) FROM applications WHERE student_id=? AND project_id=? AND status IN ('Pending','Approved','Needs information')");$x->execute([$u['id'],$pid]);if((int)$x->fetchColumn()>0)throw new RuntimeException('You already have an active application for this project.');
  $x=$pdo->prepare("SELECT COUNT(*) FROM applications WHERE project_id=? AND status='Approved'");$x->execute([$pid]);if((int)$x->fetchColumn()>=(int)$project['total_slots'])throw new RuntimeException('No available slots remain.');
  $x=$pdo->prepare("INSERT INTO applications(student_id,project_id,reason,additional_notes) VALUES(?,?,?,?) RETURNING id");$x->execute([$u['id'],$pid,$reason,$notes]);$aid=(int)$x->fetchColumn();
  $admins=$pdo->query("SELECT id FROM users WHERE role IN ('admin','superadmin') AND account_status='approved'")->fetchAll();foreach($admins as $ad)notify_user($pdo,(int)$ad['id'],'New project application',$u['name'].' submitted an application for '.$project['name'].'.');
  notify_user($pdo,$u['id'],'Application submitted','Your application for '.$project['name'].' is pending review.');audit($pdo,$u['id'],'Submitted project application','application',$aid);$pdo->commit();respond(['message'=>'Application submitted','id'=>$aid],201);
 }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();if($e instanceof RuntimeException)respond(['error'=>$e->getMessage()],422);throw $e;}
}
if(($v['action']??'')==='review') {
 $admin=require_role(['admin','superadmin']);$aid=(int)($v['application_id']??0);$status=$v['status']??'';$note=trim((string)($v['note']??''));if(!in_array($status,['Approved','Rejected','Needs information'],true))respond(['error'=>'Invalid decision.'],422);if($status==='Needs information'&&$note==='')respond(['error'=>'Explain what information is needed.'],422);
 try{$pdo->beginTransaction();$q=$pdo->prepare('SELECT * FROM applications WHERE id=? FOR UPDATE');$q->execute([$aid]);$a=$q->fetch();if(!$a)throw new RuntimeException('Application not found.');$studentLock=$pdo->prepare('SELECT id FROM users WHERE id=? FOR UPDATE');$studentLock->execute([$a['student_id']]);$projectLock=$pdo->prepare('SELECT * FROM projects WHERE id=? FOR UPDATE');$projectLock->execute([$a['project_id']]);$p=$projectLock->fetch();
  if($status==='Approved'){$x=$pdo->prepare("SELECT COUNT(*) FROM applications WHERE student_id=? AND status='Approved' AND id<>?");$x->execute([$a['student_id'],$aid]);if((int)$x->fetchColumn()>0)throw new RuntimeException('This student is already approved for another project.');$x=$pdo->prepare("SELECT COUNT(*) FROM applications WHERE project_id=? AND status='Approved' AND id<>?");$x->execute([$a['project_id'],$aid]);if((int)$x->fetchColumn()>=(int)$p['total_slots'])throw new RuntimeException('No slots remain for this project.');}
  $x=$pdo->prepare('UPDATE applications SET status=?,review_note=?,reviewed_by=?,reviewed_at=NOW() WHERE id=?');$x->execute([$status,$note,$admin['id'],$aid]);notify_and_email($pdo,(int)$a['student_id'],'Application '.$status,'Your application for '.$p['name'].' is now '.$status.'.'.($note?' Reviewer note: '.$note:''));audit($pdo,$admin['id'],$status.' application','application',$aid);$pdo->commit();respond(['message'=>'Application review saved.']);
 }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();if($e instanceof RuntimeException)respond(['error'=>$e->getMessage()],422);throw $e;}
}
respond(['error'=>'Unknown application action'],404);
