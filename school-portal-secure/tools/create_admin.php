<?php
if(PHP_SAPI!=='cli'){http_response_code(403);exit("CLI only\n");}
$config=require __DIR__.'/../config/config.php'; $d=$config['db'];
$pdo=new PDO("pgsql:host={$d['host']};port={$d['port']};dbname={$d['name']};sslmode={$d['sslmode']}",$d['user'],$d['pass'],[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$name=trim(readline('Administrator full name: ')); $email=strtolower(trim(readline('Administrator email: '))); $role=strtolower(trim(readline('Role (admin/superadmin): '))); $password=readline('Temporary password (12+ characters): ');
if($name===''||!filter_var($email,FILTER_VALIDATE_EMAIL)||!in_array($role,['admin','superadmin'],true)||strlen($password)<12){fwrite(STDERR,"Invalid details.\n");exit(1);}
try{$s=$pdo->prepare("INSERT INTO users(full_name,email,password_hash,role,account_status) VALUES(?,?,?,?,'approved') RETURNING id");$s->execute([$name,$email,password_hash($password,PASSWORD_DEFAULT),$role]);echo "Account created. ID: ".$s->fetchColumn().PHP_EOL;}
catch(PDOException $e){if($e->getCode()==='23505'){fwrite(STDERR,"Email already exists.\n");exit(1);}throw $e;}
