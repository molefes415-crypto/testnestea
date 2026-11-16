<?php
declare(strict_types=1);
require __DIR__ . '/common.php';
require __DIR__ . '/portal-payment-functions.php';
tn_method('POST');
if (stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0) tn_json(['success' => false], 415);
$secret = getenv('PAYFAST_PORTAL_SIGNING_SECRET') ?: '';
// Optional config must live outside public web hosting; never put its secret in this package.
$config = dirname(__DIR__, 3) . '/payfast-private.php';
if ($secret === '' && is_file($config)) {
    $settings = require $config;
    $secret = is_array($settings) ? (string)($settings['portal_signing_secret'] ?? '') : '';
}
if ($secret === '') tn_json(['success' => false, 'error' => 'Activation not configured'], 503);
$raw = file_get_contents('php://input', false, null, 0, 8193);
$data = tn_verified_activation(is_string($raw) ? $raw : '', $_SERVER['HTTP_X_TN_TIMESTAMP'] ?? '', $_SERVER['HTTP_X_TN_SIGNATURE'] ?? '', $secret, time());
if ($data === null) tn_json(['success' => false, 'error' => 'Unauthorized activation'], 401);
try {
    // Matches the uploaded admin/activate_mail.php config path from admin/api/.
    require_once dirname(__DIR__, 2) . '/config.php';
    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
    tn_activate_paid_client(getDBConnection(), $data);
    tn_json(['success' => true, 'payment_id' => $data['payment_id']]);
} catch (Throwable $error) {
    error_log('[payfast] Portal activation unavailable');
    tn_json(['success' => false, 'error' => 'Activation unavailable; retry notification'], 503);
}