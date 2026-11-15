<?php
// TradeNest EA — PayFast payment status for Android and iOS.
// Read-only: it forwards to the Cloud receiver, which alone marks payments
// paid after validating PayFast's signed ITN. Never decides payment itself.
//   GET payfast_status.php?payment_id=XXX   (or ?email=client@example.com)
//   -> {"success":true,"status":"paid|pending|cancelled|failed","paid":true|false,"platform":"android|ios|web"}
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Cache-Control: no-store');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

const CLOUD_STATUS = 'https://tradnestea.app/api/public/payfast?action=status';

$paymentId = preg_replace('/[^A-Za-z0-9_\-]/', '', $_GET['payment_id'] ?? ($_GET['m'] ?? ''));
$email = filter_var(trim($_GET['email'] ?? ''), FILTER_VALIDATE_EMAIL) ?: '';
$platform = in_array($_GET['platform'] ?? '', ['android', 'ios'], true) ? $_GET['platform'] : 'web';

if ($paymentId === '' && $email === '') {
  http_response_code(400);
  echo json_encode(['success' => false, 'error' => 'payment_id or email required']);
  exit;
}

$url = CLOUD_STATUS . ($paymentId !== '' ? '&payment_id=' . urlencode($paymentId) : '&email=' . urlencode($email));
$ch = curl_init($url);
curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15, CURLOPT_HTTPHEADER => ['Accept: application/json']]);
$body = curl_exec($ch);
$code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$data = $body ? json_decode($body, true) : null;
if ($code !== 200 || !is_array($data)) {
  http_response_code(502);
  echo json_encode(['success' => false, 'status' => 'unknown', 'paid' => false, 'error' => 'Payment status unavailable, try again']);
  exit;
}
echo json_encode([
  'success' => true,
  'status' => (string)($data['status'] ?? 'pending'),
  'paid' => ($data['paid'] ?? false) === true,
  'payment_id' => $paymentId ?: ($data['payment_id'] ?? null),
  'platform' => $platform,
]);
