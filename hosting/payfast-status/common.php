<?php
declare(strict_types=1);
// PHP is a relay only. No merchant keys or database credentials belong here.
const TN_CLOUD = 'https://tradnestea.app/api/public/';

function tn_json(array $data, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($data, JSON_UNESCAPED_SLASHES);
    exit;
}

function tn_method(string $method): void {
    header('Cache-Control: no-store');
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== $method) {
        header('Allow: ' . $method);
        tn_json(['success' => false, 'error' => $method . ' required'], 405);
    }
}

function tn_reference($value): string {
    return is_string($value) && preg_match('/\A[A-Za-z0-9_-]{1,120}\z/D', $value) ? $value : '';
}

function tn_cloud(string $path, string $method = 'GET', ?string $body = null, string $type = 'application/json'): array {
    if (!function_exists('curl_init')) return [503, null];
    $handle = curl_init(TN_CLOUD . $path);
    curl_setopt_array($handle, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_CUSTOMREQUEST => $method,
        CURLOPT_CONNECTTIMEOUT => 8, CURLOPT_TIMEOUT => 25,
        CURLOPT_FOLLOWLOCATION => false, CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_HTTPHEADER => ['Accept: application/json', 'Content-Type: ' . $type],
    ]);
    if ($body !== null) curl_setopt($handle, CURLOPT_POSTFIELDS, $body);
    $response = curl_exec($handle);
    $status = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
    curl_close($handle);
    return [$status, is_string($response) ? $response : null];
}