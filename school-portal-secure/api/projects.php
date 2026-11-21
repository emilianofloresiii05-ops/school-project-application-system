<?php
declare(strict_types=1);
require __DIR__.'/bootstrap.php';
if ($_SERVER['REQUEST_METHOD']==='GET') {
 $u=user(); $where=($u&&in_array($u['role'],['admin','superadmin'],true))?'':'WHERE p.status=\'published\' AND (p.deadline IS NULL OR p.deadline>=CURRENT_DATE)';
 $rows=$pdo->query("SELECT p.*, (SELECT COUNT(*) FROM applications a WHERE a.project_id=p.id AND a.status='Approved') AS approved_count FROM projects p $where ORDER BY p.created_at DESC")->fetchAll();
 foreach($rows as &$r) $r['available_slots']=max(0,(int)$r['total_slots']-(int)$r['approved_count']);
 respond(['projects'=>$rows]);
}
require_method('POST'); $u=require_role(['admin','superadmin']); csrf_check(); $v=json_input();
$name=trim((string)($v['name']??'')); $desc=trim((string)($v['description']??'')); $req=trim((string)($v['requirements']??'')); $slots=filter_var($v['slots']??null,FILTER_VALIDATE_INT);
if($name===''||$desc===''||$req===''||$slots===false||$slots<0) respond(['error'=>'Complete the required project fields.'],422);
$id=(int)($v['id']??0);
if($id>0) {
 $s=$pdo->prepare('UPDATE projects SET name=?,category=?,description=?,eligibility_requirements=?,required_documents=?,total_slots=?,deadline=?,status=?,updated_at=NOW() WHERE id=?');
 $s->execute([$name,$v['category']??null,$desc,$req,$v['documents']??null,$slots,($v['deadline']??'')?:null,$v['status']??'draft',$id]);
 audit($pdo,(int)$u['id'],'Updated project','project',$id);
} else {
 $s=$pdo->prepare('INSERT INTO projects(name,category,description,eligibility_requirements,required_documents,total_slots,deadline,status,created_by) VALUES(?,?,?,?,?,?,?,?,?) RETURNING id');
 $s->execute([$name,$v['category']??null,$desc,$req,$v['documents']??null,$slots,($v['deadline']??'')?:null,$v['status']??'draft',$u['id']]);
 $id=(int)$s->fetchColumn(); audit($pdo,(int)$u['id'],'Created project','project',$id);
}
respond(['message'=>'Project saved','id'=>$id]);
