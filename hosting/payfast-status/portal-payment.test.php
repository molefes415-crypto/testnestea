<?php
declare(strict_types=1);
require __DIR__ . '/portal-payment-functions.php';
function check($condition, string $message): void { if (!$condition) throw new RuntimeException($message); }
$input = ['payment_id'=>'tnea1', 'provider_payment_id'=>'pf1', 'admin_id'=>17, 'email'=>'client@example.com', 'amount'=>'580.00', 'currency'=>'ZAR', 'status'=>'paid'];
// Test-only signing key; never read or print hosted credentials.
$key = 'test-fixture-only';
$stamp = '1794863220';
$raw = json_encode($input);
$sign = hash_hmac('sha256', $stamp . '.' . $raw, $key);
check(tn_verified_activation($raw, $stamp, $sign, $key, (int)$stamp)['admin_id'] === 17, 'Signed mentor identity');
check(tn_verified_activation(str_replace('17', '18', $raw), $stamp, $sign, $key, (int)$stamp) === null, 'Changed mentor rejected');
check(tn_verified_activation($raw, $stamp, $sign, $key, (int)$stamp + 301) === null, 'Expired signature rejected');
check(tn_verified_activation($raw, $stamp, '', $key, (int)$stamp) === null, 'Unsigned activation rejected');
$bad = json_encode(array_merge($input, ['status'=>'pending']));
check(tn_verified_activation($bad, $stamp, hash_hmac('sha256', $stamp . '.' . $bad, $key), $key, (int)$stamp) === null, 'Pending rejected');

// Behavioural database double executes the real activation function and tracks writes.
class FakeResult {
    private $row;
    function __construct($row) { $this->row = $row; }
    function fetch_assoc() { return $this->row; }
}
class FakeStatement {
    private $db; private $sql; private $args = []; private $row;
    function __construct($db, $sql) { $this->db=$db; $this->sql=$sql; }
    function bind_param($types, &...$args) { $this->args=&$args; }
    function execute() {
        $a=$this->args; $sql=$this->sql;
        if (strpos($sql, 'SELECT id FROM admins') === 0) $this->row=['id'=>$a[0]];
        elseif (strpos($sql, 'SELECT admin_id, email') === 0) $this->row=$this->db->receipts[$a[0]] ?? null;
        elseif (strpos($sql, 'SELECT id FROM subscriptions') === 0) $this->row=$this->db->subscriptions[$a[0].':'.$a[1]] ?? null;
        elseif (strpos($sql, 'INSERT INTO subscriptions') === 0) $this->db->subscriptions[$a[0].':'.$a[1]]=['id'=>count($this->db->subscriptions)+1,'admin_id'=>$a[0],'email'=>$a[1],'payment_status'=>'paid'];
        elseif (strpos($sql, 'UPDATE subscriptions') === 0) { foreach ($this->db->subscriptions as &$s) if ($s['id']===$a[0] && $s['admin_id']===$a[1]) $s['payment_status']='paid'; }
        elseif (strpos($sql, 'INSERT INTO payfast_client_receipts') === 0) $this->db->receipts[$a[0]]=['payment_id'=>$a[1],'admin_id'=>$a[2],'email'=>$a[3]];
        elseif (strpos($sql, 'SELECT COUNT') === 0) {
            $emails=[];
            foreach ($this->db->receipts as $r) if ($r['admin_id']===$a[0] && ($this->db->subscriptions[$a[0].':'.$r['email']]['payment_status'] ?? '')==='paid') $emails[$r['email']]=true;
            $this->row=['paid_count'=>count($emails)];
        } else throw new RuntimeException('Unexpected database operation');
    }
    function get_result() { return new FakeResult($this->row); }
    function close() {}
}
class FakeDB {
    public $subscriptions=[]; public $receipts=[]; public $usedSlots=0; private $backup;
    function prepare($sql) { if (strpos($sql, 'mentor_slots') !== false) { $this->usedSlots++; throw new RuntimeException('Paid activation touched slots'); } return new FakeStatement($this,$sql); }
    function begin_transaction() { $this->backup=[$this->subscriptions,$this->receipts]; }
    function commit() {}
    function rollback() { [$this->subscriptions,$this->receipts]=$this->backup; }
}
$db=new FakeDB();
tn_activate_paid_client($db, $input);
check($db->subscriptions['17:client@example.com']['payment_status']==='paid', 'Paid under mentor 17');
check(!isset($db->subscriptions['18:client@example.com']), 'Other mentor not activated');
check($db->usedSlots===0, 'No mentor slots consumed');
tn_activate_paid_client($db, $input);
check(count($db->subscriptions)===1 && count($db->receipts)===1, 'Replay idempotent');
tn_activate_paid_client($db, array_merge($input,['provider_payment_id'=>'pf2']));
check(tn_paid_email_count($db,17)===1, 'Renewal counts email once');
check(tn_paid_email_count($db,18)===0, 'Count isolated to mentor');
try { tn_activate_paid_client($db, array_merge($input,['admin_id'=>18])); throw new RuntimeException('Reassigned receipt accepted'); }
catch (RuntimeException $error) { check($error->getMessage()==='Receipt mismatch', 'Receipt cannot change mentor'); }
echo "Portal activation: signature, mentor isolation, paid count, idempotency and zero-slot tests passed\n";