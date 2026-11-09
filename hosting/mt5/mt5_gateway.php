<?php
/**
 * mt5_gateway.php  — upload to  /admin/api/  on tradenestea.com
 *
 * Portal proxy between your app and the self-hosted MT5 gateway.
 *   GET  ?a=health            check portal -> gateway connection and admin key (no secrets shown)
 *   POST ?a=link              link a user's MT5 account (uses the admin key)
 *   *    ?a=proxy&p=<path>    forward a call as the user (header X-MT5-Token)
 *
 * The admin key lives ONLY here. Never put it in the app or in public files.
 */

// ====== CONFIG (edit mt5_config.php, not this file) ======
$CFG = require __DIR__ . '/mt5_config.php';
define('GATEWAY_URL', rtrim((string) $CFG['gateway_url'], '/'));
define('ADMIN_KEY', (string) $CFG['admin_key']);
define('ALLOWED_ORIGINS', (array) $CFG['allowed_origins']);

// Gateway paths a user token may reach (everything else is refused)
const PROXY_PATH_REGEX = '#^(account|positions|history|order|modify|close|close_all|me|quote/[A-Za-z0-9._+\#-]{1,24})$#';

// ====== CORS ======
function origin_allowed(string $origin): bool {
    foreach (ALLOWED_ORIGINS as $o) {
        if ($o === $origin) return true;
        if (strpos($o, '*') !== false) {   // wildcard like https://*.lovable.app
            $re = '#^' . str_replace('\\*', '[a-z0-9-]+', preg_quote($o, '#')) . '$#i';
            if (preg_match($re, $origin)) return true;
        }
    }
    return false;
}
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin && origin_allowed($origin)) {
    header("Access-Control-Allow-Origin: $origin");
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-MT5-Token');
header('Content-Type: application/json');
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') { http_response_code(204); exit; }

// ====== helpers ======
function out($data, int $status = 200): void {
    http_response_code($status);
    echo is_string($data) ? $data : json_encode($data);
    exit;
}

/** Call the gateway. Returns [httpStatus, body]. */
function gw(string $method, string $path, array $headers = [], ?string $body = null, int $timeout = 60): array {
    $ch = curl_init(rtrim(GATEWAY_URL, '/') . $path);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => $timeout,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_HTTPHEADER     => $headers,
    ]);
    if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    $resp = curl_exec($ch);
    $st = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err = curl_error($ch);
    curl_close($ch);
    if ($resp === false || $st === 0) return [502, json_encode(['detail' => 'Trading server unreachable. Try again shortly.'])];
    return [$st, $resp];
}

/** Independent broker login check (proof the caller knows the trading password). Session is closed straight after. */
function broker_password_ok(int $login, string $password, string $server): bool {
    $url = 'https://mt5.mtapi.io/ConnectEx?' . http_build_query(['user' => $login, 'password' => $password, 'server' => $server]);
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 60, CURLOPT_CONNECTTIMEOUT => 10]);
    $resp = curl_exec($ch);
    $st = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($st !== 200 || !is_string($resp)) return false;
    $id = trim($resp, " \t\n\r\"");
    if ($id === '' || $id[0] === '{' || !preg_match('/^[A-Za-z0-9-]{8,}$/', $id)) return false;
    $dc = curl_init('https://mt5.mtapi.io/Disconnect?' . http_build_query(['id' => $id]));
    curl_setopt_array($dc, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10]);
    curl_exec($dc);
    curl_close($dc);
    return true;
}

$action = $_GET['a'] ?? '';

// ====== HEALTH: connectivity + admin key test (safe to open in a browser, shows no secrets) ======
if ($action === 'health') {
    [$st, $raw] = gw('GET', '/admin/accounts', ['X-Admin-Key: ' . ADMIN_KEY], null, 15);
    $d = json_decode($raw, true);
    out([
        'portal'              => 'ok',
        'gateway_http_status' => $st,
        'gateway_reachable'   => ($st !== 502),
        'admin_key_ok'        => ($st === 200),
        'linked_accounts'     => ($st === 200 && is_array($d)) ? count($d) : null,
        'detail'              => ($st !== 200 && is_array($d)) ? ($d['detail'] ?? null) : null,
    ], 200);
}

// ====== LINK: create the user's private terminal ======
if ($action === 'link' && ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
    @set_time_limit(240);   // first login can take a while (host must allow this)
    $b = json_decode(file_get_contents('php://input'), true) ?: [];
    $login    = (int) ($b['login'] ?? 0);
    $password = (string) ($b['password'] ?? '');
    $server   = trim((string) ($b['server'] ?? ''));
    $email    = strtolower(trim((string) ($b['email'] ?? '')));
    $adminId  = trim((string) ($b['adminId'] ?? ''));

    if ($login <= 0 || $password === '' || $server === '' || $email === '' || $adminId === '') {
        out(['detail' => 'Missing login, password, server or user details.'], 400);
    }
    // Linking is free. Email/adminId identify the request only; no subscription lookup.
    // They are client supplied, so they must never authorize account replacement.

    $adminHdr = ['X-Admin-Key: ' . ADMIN_KEY, 'Content-Type: application/json'];
    $payload  = json_encode(['login' => $login, 'password' => $password, 'server' => $server, 'label' => $email]);

    [$st, $raw] = gw('POST', '/admin/accounts', $adminHdr, $payload, 220);

    // Re-link of an already-linked account. The email label is NOT proof of ownership;
    // only a broker-verified trading password is. Verify it first, then replace the old terminal.
    if ($st === 409) {
        if (!broker_password_ok($login, $password, $server)) {
            out(['detail' => 'This MT5 account is already linked. Enter its correct trading password to log in again.'], 401);
        }
        [$ls, $lraw] = gw('GET', '/admin/accounts', $adminHdr, null, 20);
        $existing = null;
        foreach ((array) json_decode($lraw, true) as $a) {
            if ((int) ($a['login'] ?? 0) === $login && strcasecmp((string) ($a['server'] ?? ''), $server) === 0) { $existing = $a; break; }
        }
        if ($existing && !empty($existing['account_id'])) {
            gw('DELETE', '/admin/accounts/' . rawurlencode((string) $existing['account_id']), $adminHdr, null, 30);
        }
        [$st, $raw] = gw('POST', '/admin/accounts', $adminHdr, $payload, 220);
    }
    out($raw, $st);   // success => { account_id, token, account }
}

// ====== PROXY: forward a call as the user ======
if ($action === 'proxy') {
    $token = trim($_SERVER['HTTP_X_MT5_TOKEN'] ?? '');
    $path  = (string) ($_GET['p'] ?? '');
    if ($token === '') out(['detail' => 'Missing token'], 401);
    if (!preg_match(PROXY_PATH_REGEX, $path)) out(['detail' => 'Unknown endpoint'], 404);

    $method = $_SERVER['REQUEST_METHOD'];
    if ($path === 'me') {
        if ($method !== 'DELETE') out(['detail' => 'Method not allowed'], 405);
        $gwPath = '/me';
    } else {
        if (!in_array($method, ['GET', 'POST'], true)) out(['detail' => 'Method not allowed'], 405);
        $q = $_GET; unset($q['a'], $q['p']);            // forward things like ?days=7
        $gwPath = '/api/' . $path . ($q ? '?' . http_build_query($q) : '');
    }

    $hdr = ['Authorization: Bearer ' . $token];
    $body = null;
    if ($method === 'POST') { $hdr[] = 'Content-Type: application/json'; $body = file_get_contents('php://input'); }

    [$st, $raw] = gw($method, $gwPath, $hdr, $body, 45);
    out($raw, $st);
}

// Opening the bare URL (no ?a=...) just confirms the file is installed
if ($action === '') out(['portal' => 'ok', 'hint' => 'Use ?a=health to test the gateway connection.'], 200);

out(['detail' => 'Not found'], 404);