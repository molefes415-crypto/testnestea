<?php
declare(strict_types=1);

function tn_verified_activation(string $raw, string $timestamp, string $signature, string $secret, int $now): ?array {
    if ($secret === '' || strlen($raw) > 8192 || !preg_match('/\A\d{10}\z/D', $timestamp) || abs($now - (int)$timestamp) > 300) return null;
    if (!preg_match('/\A[a-f0-9]{64}\z/D', $signature) || !hash_equals(hash_hmac('sha256', $timestamp . '.' . $raw, $secret), $signature)) return null;
    $data = json_decode($raw, true);
    if (!is_array($data) || ($data['status'] ?? '') !== 'paid' || ($data['amount'] ?? '') !== '580.00' || ($data['currency'] ?? '') !== 'ZAR') return null;
    $mentor = filter_var($data['admin_id'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 2147483647]]);
    if ($mentor === false || !is_string($data['email'] ?? null) || strlen($data['email']) > 254 || !filter_var($data['email'], FILTER_VALIDATE_EMAIL)) return null;
    foreach (['payment_id', 'provider_payment_id'] as $field) {
        if (!is_string($data[$field] ?? null) || !preg_match('/\A[A-Za-z0-9_-]{1,120}\z/D', $data[$field])) return null;
    }
    $data['admin_id'] = $mentor;
    $data['email'] = strtolower(trim($data['email']));
    return $data;
}

function tn_activate_paid_client($conn, array $data): void {
    $conn->begin_transaction();
    try {
        // Serialise each mentor's callbacks to avoid duplicate subscription creation.
        $stmt = $conn->prepare('SELECT id FROM admins WHERE id = ? FOR UPDATE');
        $stmt->bind_param('i', $data['admin_id']);
        $stmt->execute();
        if (!$stmt->get_result()->fetch_assoc()) throw new RuntimeException('Unknown mentor');
        $stmt->close();
        $stmt = $conn->prepare('SELECT admin_id, email, payment_id FROM payfast_client_receipts WHERE provider_payment_id = ?');
        $stmt->bind_param('s', $data['provider_payment_id']);
        $stmt->execute();
        $receipt = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        if ($receipt) {
            if ((int)$receipt['admin_id'] !== $data['admin_id'] || strtolower($receipt['email']) !== $data['email'] || $receipt['payment_id'] !== $data['payment_id']) throw new RuntimeException('Receipt mismatch');
            $conn->commit();
            return;
        }
        $stmt = $conn->prepare('SELECT id FROM subscriptions WHERE admin_id = ? AND email = ? LIMIT 1 FOR UPDATE');
        $stmt->bind_param('is', $data['admin_id'], $data['email']);
        $stmt->execute();
        $subscription = $stmt->get_result()->fetch_assoc();
        $stmt->close();
        if ($subscription) {
            $stmt = $conn->prepare("UPDATE subscriptions SET payment_status = 'paid' WHERE id = ? AND admin_id = ?");
            $stmt->bind_param('ii', $subscription['id'], $data['admin_id']);
        } else {
            $stmt = $conn->prepare("INSERT INTO subscriptions (admin_id, email, payment_status, has_logged_in, created_at) VALUES (?, ?, 'paid', 0, NOW())");
            $stmt->bind_param('is', $data['admin_id'], $data['email']);
        }
        $stmt->execute();
        $stmt->close();
        $stmt = $conn->prepare('INSERT INTO payfast_client_receipts (provider_payment_id, payment_id, admin_id, email, amount, currency) VALUES (?, ?, ?, ?, ?, ?)');
        $stmt->bind_param('ssisss', $data['provider_payment_id'], $data['payment_id'], $data['admin_id'], $data['email'], $data['amount'], $data['currency']);
        $stmt->execute();
        $stmt->close();
        // Directly paid clients never read or modify mentor_slots.
        $conn->commit();
    } catch (Throwable $error) {
        $conn->rollback();
        throw $error;
    }
}

function tn_paid_email_count($conn, int $mentor): int {
    // Count unique currently-paid portal emails, not renewal receipts or slot grants.
    $stmt = $conn->prepare("SELECT COUNT(DISTINCT r.email) AS paid_count FROM payfast_client_receipts r INNER JOIN subscriptions s ON s.admin_id = r.admin_id AND s.email = r.email WHERE r.admin_id = ? AND s.payment_status = 'paid'");
    $stmt->bind_param('i', $mentor);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    return (int)($row['paid_count'] ?? 0);
}