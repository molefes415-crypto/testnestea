<?php
declare(strict_types=1);
require __DIR__ . '/common.php';
tn_method('POST');
$raw = file_get_contents('php://input', false, null, 0, 8193);
if ($raw === false || strlen($raw) > 8192) tn_json(['success' => false, 'error' => 'Invalid checkout request'], 400);
$input = json_decode($raw, true);
if (!is_array($input) || !is_string($input['email'] ?? null) || !filter_var($input['email'], FILTER_VALIDATE_EMAIL)) {
    tn_json(['success' => false, 'error' => 'Valid customer email required'], 400);
}
$email = strtolower(trim($input['email']));
$ref = $input['user_ref'] ?? '';
if (!is_string($ref) || strlen($ref) > 120) tn_json(['success' => false, 'error' => 'Invalid customer reference'], 400);
$mentor = filter_var($input['admin_id'] ?? $ref, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 2147483647]]);
if ($mentor === false) tn_json(['success' => false, 'error' => 'Valid mentor ID required'], 400);
[$code, $body] = tn_cloud('payfast?action=create', 'POST', json_encode(['email' => $email, 'admin_id' => $mentor, 'user_ref' => (string)$mentor]));
$data = $body !== null ? json_decode($body, true) : null;
if ($code !== 200 || !is_array($data) || !tn_reference($data['payment_id'] ?? null)) {
    tn_json(['success' => false, 'error' => 'Checkout unavailable. Please try again.'], 503);
}
// Native apps open launch_url in an external browser and retain payment_id locally.
tn_json(['success' => true] + $data);