<?php
declare(strict_types=1);
require __DIR__ . '/common.php';
tn_method('POST');
if (stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/x-www-form-urlencoded') !== 0) {
    tn_json(['success' => false, 'error' => 'Form notification required'], 415);
}
$raw = file_get_contents('php://input', false, null, 0, 32769);
if ($raw === false || strlen($raw) > 32768 || $raw === '') {
    tn_json(['success' => false, 'error' => 'Invalid notification size'], 400);
}
// Preserve the exact signed bytes. Only Cloud validates and updates existing payments.
[$code, $body] = tn_cloud('payfast-itn', 'POST', $raw, 'application/x-www-form-urlencoded');
if ($code === 200 && $body !== null) {
    header('Content-Type: text/plain; charset=utf-8');
    echo 'ok';
    exit;
}
http_response_code($code >= 400 && $code < 500 ? 400 : 503);
header('Content-Type: text/plain; charset=utf-8');
echo $code >= 400 && $code < 500 ? 'Notification rejected' : 'Please retry notification';