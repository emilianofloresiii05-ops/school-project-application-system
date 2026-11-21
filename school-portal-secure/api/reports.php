<?php
declare(strict_types=1);
require __DIR__ . '/bootstrap.php';

$admin = require_role(['admin', 'superadmin']);
require_method('GET');

$type  = ($_GET['type'] ?? 'daily') === 'monthly' ? 'monthly' : 'daily';
$date  = preg_match('/^\d{4}-\d{2}-\d{2}$/', $_GET['date'] ?? '') ? $_GET['date'] : date('Y-m-d');
$month = preg_match('/^\d{4}-\d{2}$/', $_GET['month'] ?? '') ? $_GET['month'] : date('Y-m');

if ($type === 'daily') {
    $userStmt = $pdo->prepare("
        SELECT DISTINCT u.id, u.full_name, u.lrn, u.grade_level, u.section, u.strand,
               MIN(l.created_at) AS first_activity_at,
               MAX(l.created_at) AS last_activity_at
        FROM activity_logs l
        JOIN users u ON u.id = l.actor_id
        WHERE u.role = 'student' AND DATE(l.created_at) = ?
        GROUP BY u.id, u.full_name, u.lrn, u.grade_level, u.section, u.strand
        ORDER BY first_activity_at ASC
    ");
    $userStmt->execute([$date]);

    $appStmt = $pdo->prepare("
        SELECT a.id, a.student_id, u.full_name AS student_name, u.lrn, u.grade_level, u.section, u.strand,
               a.project_id, p.name AS project_name, a.status, a.submitted_at, a.reviewed_at
        FROM applications a
        JOIN users u ON u.id = a.student_id
        JOIN projects p ON p.id = a.project_id
        WHERE DATE(a.submitted_at) = ?
        ORDER BY a.submitted_at ASC
    ");
    $appStmt->execute([$date]);

    $decisionStmt = $pdo->prepare("
        SELECT a.id, a.student_id, u.full_name AS student_name, u.lrn,
               a.project_id, p.name AS project_name, a.status, a.submitted_at, a.reviewed_at
        FROM applications a
        JOIN users u ON u.id = a.student_id
        JOIN projects p ON p.id = a.project_id
        WHERE a.status IN ('Approved', 'Rejected')
          AND DATE(COALESCE(a.reviewed_at, a.submitted_at)) = ?
        ORDER BY p.name ASC, a.reviewed_at ASC
    ");
    $decisionStmt->execute([$date]);
    $periodLabel = $date;
} else {
    [$yr, $mo] = explode('-', $month);

    $userStmt = $pdo->prepare("
        SELECT DISTINCT u.id, u.full_name, u.lrn, u.grade_level, u.section, u.strand,
               MIN(l.created_at) AS first_activity_at,
               MAX(l.created_at) AS last_activity_at
        FROM activity_logs l
        JOIN users u ON u.id = l.actor_id
        WHERE u.role = 'student' AND EXTRACT(YEAR FROM l.created_at) = ? AND EXTRACT(MONTH FROM l.created_at) = ?
        GROUP BY u.id, u.full_name, u.lrn, u.grade_level, u.section, u.strand
        ORDER BY first_activity_at ASC
    ");
    $userStmt->execute([(int)$yr, (int)$mo]);

    $appStmt = $pdo->prepare("
        SELECT a.id, a.student_id, u.full_name AS student_name, u.lrn, u.grade_level, u.section, u.strand,
               a.project_id, p.name AS project_name, a.status, a.submitted_at, a.reviewed_at
        FROM applications a
        JOIN users u ON u.id = a.student_id
        JOIN projects p ON p.id = a.project_id
        WHERE EXTRACT(YEAR FROM a.submitted_at) = ? AND EXTRACT(MONTH FROM a.submitted_at) = ?
        ORDER BY a.submitted_at ASC
    ");
    $appStmt->execute([(int)$yr, (int)$mo]);

    $decisionStmt = $pdo->prepare("
        SELECT a.id, a.student_id, u.full_name AS student_name, u.lrn,
               a.project_id, p.name AS project_name, a.status, a.submitted_at, a.reviewed_at
        FROM applications a
        JOIN users u ON u.id = a.student_id
        JOIN projects p ON p.id = a.project_id
        WHERE a.status IN ('Approved', 'Rejected')
          AND EXTRACT(YEAR FROM COALESCE(a.reviewed_at, a.submitted_at)) = ?
          AND EXTRACT(MONTH FROM COALESCE(a.reviewed_at, a.submitted_at)) = ?
        ORDER BY p.name ASC, a.reviewed_at ASC
    ");
    $decisionStmt->execute([(int)$yr, (int)$mo]);
    $periodLabel = $month;
}

$activeStudents = $userStmt->fetchAll();
$applications   = $appStmt->fetchAll();
$decisions      = $decisionStmt->fetchAll();

$allProjects = $pdo->query("SELECT id, name FROM projects ORDER BY name ASC")->fetchAll();
$projectSummary = [];
foreach ($allProjects as $proj) {
    $projectSummary[$proj['id']] = [
        'project_id'        => (int)$proj['id'],
        'project_name'      => $proj['name'],
        'accepted_count'    => 0,
        'rejected_count'    => 0,
        'accepted_students' => [],
        'rejected_students' => []
    ];
}

foreach ($decisions as $row) {
    $pid = (int)$row['project_id'];
    if (!isset($projectSummary[$pid])) {
        $projectSummary[$pid] = [
            'project_id'        => $pid,
            'project_name'      => $row['project_name'],
            'accepted_count'    => 0,
            'rejected_count'    => 0,
            'accepted_students' => [],
            'rejected_students' => []
        ];
    }
    $entry = [
        'student_name' => $row['student_name'],
        'lrn'          => $row['lrn'],
        'applied_at'   => $row['submitted_at'],
        'reviewed_at'  => $row['reviewed_at']
    ];
    if ($row['status'] === 'Approved') {
        $projectSummary[$pid]['accepted_count']++;
        $projectSummary[$pid]['accepted_students'][] = $entry;
    } elseif ($row['status'] === 'Rejected') {
        $projectSummary[$pid]['rejected_count']++;
        $projectSummary[$pid]['rejected_students'][] = $entry;
    }
}

respond([
    'report_type'        => $type,
    'period'             => $periodLabel,
    'generated_at'       => date('Y-m-d H:i:s'),
    'system_users'       => $activeStudents,
    'applications'       => $applications,
    'project_breakdown'  => array_values($projectSummary)
]);
