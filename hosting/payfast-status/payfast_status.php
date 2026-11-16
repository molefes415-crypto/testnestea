<?php
declare(strict_types=1);
require __DIR__ . '/common.php';
tn_method('GET');
$paymentId = tn_reference($_GET['payment_id'] ?? ($_GET['m'] ?? null));
if ($paymentId === '') tn_json(['success' => false, 'paid' => false, 'error' => 'Valid payment_id required'], 400);
[$code, $body] = tn_cloud('payfast?action=status&payment_id=' . rawurlencode($paymentId));
$data = $body !== null ? json_decode($body, true) : null;
if ($code !== 200 || !is_array($data) || ($data['payment_id'] ?? null) !== $paymentId) {
    tn_json(['success' => false, 'status' => 'unknown', 'paid' => false, 'error' => 'Payment status unavailable'], 503);
}
$status = $data['status'] ?? 'pending';
if (!in_array($status, ['paid', 'pending', 'cancelled', 'failed'], true)) $status = 'pending';
tn_json(['success' => true, 'status' => $status, 'paid' => $status === 'paid' && ($data['paid'] ?? false) === true, 'payment_id' => $paymentId]);
