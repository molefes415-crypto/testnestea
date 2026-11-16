<?php
session_start();
require_once __DIR__ . '/../config.php';

$conn = getDBConnection();

if (!isset($_SESSION['admin_id'])) {
    header("Location: /admin/index.php");
    exit;
}

$owner_id = (int)$_SESSION['admin_id'];
$email = $_SESSION['email'] ?? '';

/* ─── SLOT INFO ─── */
$slot = $conn->query("
    SELECT total_slots, used_slots
    FROM mentor_slots
    WHERE owner_id = $owner_id
")->fetch_assoc();

$total_slots = (int)($slot['total_slots'] ?? 0);
$used_slots  = (int)($slot['used_slots']  ?? 0);
$remaining   = max(0, $total_slots - $used_slots);
require_once __DIR__ . '/api/portal-payment-functions.php';
$paid_count = null;
try { $paid_count = tn_paid_email_count($conn, $owner_id); }
catch (Throwable $error) { error_log('[payfast] Paid email count unavailable'); }

/* =========================================================
   FETCH ADMIN INFO (FOR SIDEBAR IMAGE + EMAIL)
========================================================= */
$stmt = $conn->prepare("
    SELECT mentor_name, display_name, email, profile_pic
    FROM admins
    WHERE id = ?
");
$stmt->bind_param("i", $owner_id);
$stmt->execute();
$result = $stmt->get_result();
$admin = $result->fetch_assoc();
$stmt->close();

if (!$admin) {
    $admin = [
        'mentor_name' => '',
        'display_name' => '',
        'email' => '',
        'profile_pic' => ''
    ];
}

$email        = $admin['email'] ?? '';
$display_name = $admin['display_name'] ?? $admin['mentor_name'] ?? '';
$picture_url  = $admin['profile_pic'] ?? '';

/* ─── ACTIVATED EMAILS ─── */
$stmt = $conn->prepare("
    SELECT id, email, has_logged_in, created_at
    FROM subscriptions
    WHERE admin_id = ?
    ORDER BY created_at DESC
");
$stmt->bind_param("i", $owner_id);
$stmt->execute();
$emails_result = $stmt->get_result();
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
  <title>Email Activations | TradeNest</title>

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@mdi/font@7.2.96/css/materialdesignicons.min.css">

  <link rel="stylesheet" href="vendors/feather/feather.css">
  <link rel="stylesheet" href="vendors/ti-icons/css/themify-icons.css">
  <link rel="stylesheet" href="vendors/css/vendor.bundle.base.css">
  <link rel="shortcut icon" href="./images/logo.png" />
  <link rel="icon" href="./images/logo.png" />

  <style>
    :root {
      --acc: #E5323E;
      --acc-dk: #B3202B;
      --acc-lt: rgba(229,50,62,0.14);
      --acc-glow: rgba(229,50,62,0.35);
      --bg-primary: #0A0507;
      --bg-secondary: #160A0D;
      --bg-tertiary: #221014;
      --bg-glass: rgba(22,10,13,0.82);
      --bg-glass-card: rgba(46,16,22,0.52);
      --text-primary: #FFFFFF;
      --text-secondary: rgba(255,255,255,0.72);
      --text-tertiary: rgba(255,255,255,0.48);
      --border-light: rgba(255,255,255,0.08);
      --border-medium: rgba(255,255,255,0.14);
      --border-glow: rgba(229,50,62,0.35);
      --shadow-lg: 0 12px 40px rgba(0,0,0,0.55);
      --shadow-glow: 0 0 44px rgba(229,50,62,0.22);
      --radius-sm: 10px;
      --radius-md: 14px;
      --radius-lg: 18px;
      --radius-xl: 26px;
      --radius-full: 9999px;
      --sidebar-width: 260px;
      --grn: #34D399;
      --grn-lt: rgba(52,211,153,0.12);
      --amb: #FBBF24;
      --amb-lt: rgba(251,191,36,0.12);
    }
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Manrope',-apple-system,BlinkMacSystemFont,sans-serif !important;background:var(--bg-primary) !important;color:var(--text-primary);line-height:1.6;-webkit-font-smoothing:antialiased;min-height:100vh;overflow-x:hidden}
    h1,h2,h3,h4,.sidebar-brand-text{font-family:'Sora',sans-serif}

    /* ─── Ambient red background ─── */
    .ios-bg-animation{position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden}
    .ios-bg-orb{position:absolute;border-radius:50%;filter:blur(90px);opacity:0.35;animation:orbFloat 25s ease-in-out infinite}
    .ios-bg-orb-1{width:520px;height:520px;background:radial-gradient(circle,rgba(229,50,62,0.45) 0%,transparent 70%);top:-16%;right:-10%}
    .ios-bg-orb-2{width:420px;height:420px;background:radial-gradient(circle,rgba(179,32,43,0.4) 0%,transparent 70%);bottom:-12%;left:-10%;animation-delay:-12s}
    .ios-bg-orb-3{width:320px;height:320px;background:radial-gradient(circle,rgba(229,50,62,0.28) 0%,transparent 70%);top:42%;left:32%;animation-delay:-6s}
    @keyframes orbFloat{0%,100%{transform:translate(0,0) scale(1)}33%{transform:translate(30px,-40px) scale(1.1)}66%{transform:translate(-20px,20px) scale(0.95)}}
    .ios-bg-grid{position:fixed;inset:0;pointer-events:none;z-index:0;opacity:0.03;background-image:linear-gradient(rgba(229,50,62,0.6) 1px,transparent 1px),linear-gradient(90deg,rgba(229,50,62,0.6) 1px,transparent 1px);background-size:60px 60px;animation:gridMove 50s linear infinite}
    @keyframes gridMove{0%{transform:translate(0,0)}100%{transform:translate(60px,60px)}}
    .ios-edge-glow{position:fixed;top:0;width:2px;height:100%;pointer-events:none;z-index:1000;animation:edgePulse 4s ease-in-out infinite}
    .ios-edge-glow-left{left:var(--sidebar-width);background:linear-gradient(to bottom,transparent,var(--acc) 50%,transparent);box-shadow:0 0 18px var(--acc-glow)}
    @keyframes edgePulse{0%,100%{opacity:0.3}50%{opacity:0.75}}

    /* ─── Top bar ─── */
    .navbar{position:fixed !important;top:0;left:var(--sidebar-width);right:0;height:70px;background:var(--bg-glass) !important;backdrop-filter:blur(22px) saturate(180%);-webkit-backdrop-filter:blur(22px) saturate(180%);border-bottom:1px solid var(--border-light) !important;z-index:100;display:flex;align-items:center;padding:0 24px !important;transition:all 0.3s ease}
    .navbar-brand-wrapper{display:none !important}
    .navbar-menu-wrapper{width:100%;display:flex;align-items:center;justify-content:space-between;padding:0 !important;background:transparent !important}
    .mobile-menu-btn{width:48px;height:48px;display:none;align-items:center;justify-content:center;background:var(--bg-tertiary) !important;border:1px solid var(--border-medium) !important;border-radius:var(--radius-md) !important;color:var(--text-primary) !important;font-size:26px;cursor:pointer;transition:all 0.2s ease;padding:0 !important;outline:none !important;box-shadow:none !important;-webkit-appearance:none;appearance:none;-webkit-tap-highlight-color:transparent;touch-action:manipulation;user-select:none}
    .mobile-menu-btn:hover,.mobile-menu-btn:active{background:var(--acc) !important;border-color:var(--acc) !important;transform:scale(1.05)}
    .mobile-menu-btn:focus{outline:none !important;box-shadow:0 0 0 3px var(--acc-lt) !important}
    .mobile-menu-btn i{color:inherit !important;font-size:26px;line-height:1;pointer-events:none}
    .navbar-toggler{display:none !important}
    .navbar-title{font-size:16px;font-weight:500;color:var(--text-secondary)}
    .navbar-date{display:flex;align-items:center;gap:10px;padding:10px 18px;background:var(--bg-glass-card);border:1px solid var(--border-light);border-radius:var(--radius-full);font-size:14px;font-weight:600;color:var(--text-secondary);transition:all 0.2s ease}
    .navbar-date:hover{border-color:var(--border-glow);color:var(--text-primary)}
    .navbar-date i{font-size:18px;color:var(--acc)}

    /* ─── Sidebar ─── */
    .sidebar{position:fixed !important;top:0;left:0;width:var(--sidebar-width) !important;height:100vh;background:linear-gradient(180deg,rgba(26,10,14,0.96) 0%,rgba(10,5,7,0.98) 100%) !important;backdrop-filter:blur(40px) saturate(180%);-webkit-backdrop-filter:blur(40px) saturate(180%);border-right:1px solid var(--border-light) !important;padding:0 !important;z-index:200;display:flex;flex-direction:column;transition:transform 0.3s cubic-bezier(0.4,0,0.2,1);box-shadow:4px 0 30px rgba(0,0,0,0.4)}
    .sidebar-brand{display:flex;align-items:center;gap:14px;padding:24px 20px;border-bottom:1px solid var(--border-light);flex-shrink:0}
    .sidebar-brand-icon{width:48px;height:48px;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--acc),var(--acc-dk));border-radius:var(--radius-md);color:white;font-size:26px;box-shadow:0 0 26px var(--acc-glow);flex-shrink:0}
    .sidebar-brand-text{font-size:1.35rem;font-weight:800;color:var(--text-primary);letter-spacing:-0.02em}
    .sidebar-brand-text span{color:var(--acc)}
    .sidebar-profile{padding:20px 16px;border-bottom:1px solid var(--border-light);flex-shrink:0}
    .sidebar-profile-card{display:flex;align-items:center;gap:14px;padding:14px 16px;background:var(--acc-lt);border:1px solid var(--border-glow);border-radius:var(--radius-lg);transition:all 0.3s ease;text-decoration:none !important}
    .sidebar-profile-card:hover{background:rgba(229,50,62,0.2);transform:translateX(4px);box-shadow:0 0 22px var(--acc-glow)}
    .sidebar-profile-avatar{width:46px;height:46px;border-radius:var(--radius-md);object-fit:cover;border:2px solid var(--acc);flex-shrink:0;box-shadow:0 0 16px var(--acc-glow)}
    .sidebar-profile-info{flex:1;min-width:0}
    .sidebar-profile-name{font-size:15px;font-weight:600;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px}
    .sidebar-profile-role{font-size:12px;color:var(--acc);font-weight:600}
    .sidebar .nav{flex:1;padding:16px 12px !important;overflow-y:auto;overflow-x:hidden;display:flex;flex-direction:column;gap:2px;scrollbar-width:none;-ms-overflow-style:none}
    .sidebar .nav::-webkit-scrollbar{display:none}
    .sidebar .nav-item{margin:0 !important;padding:0 !important;list-style:none}
    .sidebar .nav-link{display:flex;align-items:center;gap:14px;padding:14px 18px !important;border-radius:var(--radius-md);color:var(--text-secondary) !important;font-size:14px;font-weight:500;transition:all 0.2s ease;border:1px solid transparent;background:transparent !important;height:auto !important;white-space:nowrap;text-decoration:none !important}
    .sidebar .nav-link:hover{background:rgba(255,255,255,0.05) !important;color:var(--text-primary) !important;text-decoration:none !important}
    .sidebar .nav-link.active,.sidebar .nav-item.active .nav-link{background:var(--acc-lt) !important;color:var(--acc) !important;border-color:var(--border-glow);box-shadow:0 0 22px rgba(229,50,62,0.18);text-decoration:none !important}
    .sidebar .nav-link i,.sidebar .nav-link .menu-icon{font-size:20px;width:24px;text-align:center;color:inherit !important;flex-shrink:0}
    .sidebar .nav-link .menu-title{color:inherit !important;font-weight:500;text-decoration:none !important}
    .nav-section-title{font-size:11px;font-weight:700;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.12em;padding:24px 18px 10px;margin:0}
    .sidebar a,.sidebar a:hover,.sidebar a:focus,.sidebar a:active{text-decoration:none !important}
    .sidebar-logout{padding:16px;border-top:1px solid var(--border-light);flex-shrink:0;margin-top:auto}
    .sidebar-logout-btn{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;padding:14px 18px;background:var(--acc-lt);border:1px solid var(--border-glow);border-radius:var(--radius-md);color:var(--acc) !important;font-size:14px;font-weight:700;text-decoration:none !important;transition:all 0.2s ease}
    .sidebar-logout-btn:hover{background:var(--acc);color:white !important;box-shadow:0 0 28px var(--acc-glow);transform:translateY(-2px);text-decoration:none !important}
    .sidebar-logout-btn i{font-size:20px}

    .container-scroller{background:var(--bg-primary) !important}
    .container-fluid.page-body-wrapper{padding:0 !important;background:var(--bg-primary) !important;min-height:100vh}
    .main-panel{margin-left:var(--sidebar-width) !important;width:calc(100% - var(--sidebar-width)) !important;background:transparent !important;min-height:100vh;position:relative;z-index:1}
    .content-wrapper{padding:100px 32px 32px !important;background:transparent !important;min-height:100vh}

    .sidebar-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.7);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);z-index:9998;opacity:0;visibility:hidden;transition:opacity 0.3s ease,visibility 0.3s ease;pointer-events:none}
    .sidebar-overlay.active{opacity:1;visibility:visible;pointer-events:auto}

    @media(max-width:991px){
      .sidebar{transform:translateX(-100%) !important;z-index:9999 !important;width:280px !important}
      .sidebar.sidebar-open{transform:translateX(0) !important}
      .navbar{left:0 !important;padding:0 16px !important}
      .main-panel{margin-left:0 !important;width:100% !important}
      .ios-edge-glow-left{display:none !important}
      .mobile-menu-btn{display:flex !important}
      .content-wrapper{padding:90px 16px 24px !important}
      .navbar-date{padding:8px 14px;font-size:13px}
      .navbar-date span{display:none}
      .navbar-date i{font-size:20px}
    }
    @media(max-width:576px){
      .sidebar{width:260px !important}
      .content-wrapper{padding:80px 12px 20px !important}
      .navbar{height:60px;padding:0 12px !important}
      .mobile-menu-btn{width:44px;height:44px}
    }

    .text-primary{color:var(--acc) !important}
    .form-control{background:var(--bg-glass-card) !important;border:1px solid var(--border-light) !important;border-radius:var(--radius-md) !important;color:var(--text-primary) !important;padding:12px 16px !important;transition:all 0.2s ease}
    .form-control:focus{border-color:var(--border-glow) !important;box-shadow:0 0 0 3px var(--acc-lt) !important;background:var(--bg-tertiary) !important}
    .form-control::placeholder{color:var(--text-tertiary) !important}

    /* ─── Page ─── */
    .ea-hdr{display:flex;align-items:flex-end;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:22px;animation:eaFade 0.4s ease both}
    .ea-hdr h2{font-size:1.5rem !important;font-weight:800 !important;color:var(--text-primary) !important;margin:0 0 4px !important;letter-spacing:-0.01em}
    .ea-hdr p{font-size:0.84rem;color:var(--text-tertiary);margin:0}
    .owner-badge{display:inline-flex;align-items:center;gap:6px;background:var(--acc-lt);border:1px solid var(--border-glow);border-radius:20px;padding:6px 16px;font-size:0.72rem;font-weight:700;color:var(--acc);box-shadow:0 0 18px rgba(229,50,62,0.12)}
    .owner-badge span{font-weight:500;opacity:0.75}

    .ea-stats{display:flex;gap:14px;margin-bottom:20px;flex-wrap:wrap}
    .ea-stat{background:var(--bg-glass-card);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border:1px solid var(--border-light);border-radius:var(--radius-lg);padding:18px 20px;display:flex;align-items:center;gap:14px;flex:1;min-width:140px;transition:all 0.25s;animation:eaFade 0.4s ease both;position:relative;overflow:hidden}
    .ea-stat::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.25),transparent)}
    .ea-stat:hover{border-color:var(--border-glow);transform:translateY(-3px);box-shadow:var(--shadow-glow)}
    .ea-stat-icon{width:46px;height:46px;border-radius:var(--radius-sm);display:flex;align-items:center;justify-content:center;font-size:1.15rem;flex-shrink:0}
    .ic-red{background:var(--acc-lt);color:var(--acc);box-shadow:0 0 16px rgba(229,50,62,0.18)}
    .ic-grn{background:var(--grn-lt);color:var(--grn)}
    .ic-amb{background:var(--amb-lt);color:var(--amb)}
    .ea-stat-data h4{font-size:1.55rem !important;font-weight:800 !important;color:var(--text-primary) !important;line-height:1;margin:0 0 3px !important;font-variant-numeric:tabular-nums}
    .ea-stat-data span{font-size:0.67rem;font-weight:700;text-transform:uppercase;letter-spacing:0.09em;color:var(--text-tertiary)}

    /* ─── Activate card ─── */
    .ea-activate-card{background:var(--bg-glass-card);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid var(--border-light);border-radius:var(--radius-xl);margin-bottom:18px;overflow:hidden;animation:eaFade 0.4s ease 0.1s both;position:relative;transition:border-color 0.25s}
    .ea-activate-card::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(229,50,62,0.6),transparent)}
    .ea-activate-card:hover{border-color:var(--border-glow)}
    .ea-card-top{padding:18px 22px;border-bottom:1px solid var(--border-light);display:flex;align-items:center;gap:12px}
    .ea-card-top-ic{width:38px;height:38px;border-radius:10px;background:var(--acc-lt);border:1px solid var(--border-glow);display:flex;align-items:center;justify-content:center;color:var(--acc);font-size:1.1rem;flex-shrink:0}
    .ea-card-top h3{font-size:1rem !important;font-weight:700 !important;color:var(--text-primary) !important;margin:0 0 2px !important}
    .ea-card-top p{font-size:0.78rem;color:var(--text-tertiary);margin:0}
    .ea-activate-body{padding:20px 22px;display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap}
    .ea-activate-body form{display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;flex:1;width:100%}
    .ea-inp-wrap{flex:1;min-width:220px;position:relative}
    .ea-inp-wrap i{position:absolute;left:14px;top:50%;transform:translateY(-50%);color:var(--text-tertiary);font-size:1.1rem;pointer-events:none}
    .ea-email-inp{width:100%;padding:13px 14px 13px 44px;background:rgba(255,255,255,0.05);border:1px solid var(--border-medium);border-radius:var(--radius-sm);color:var(--text-primary);font-size:0.88rem;outline:none;transition:all 0.2s;font-family:inherit}
    .ea-email-inp::placeholder{color:var(--text-tertiary)}
    .ea-email-inp:focus{border-color:var(--acc);background:var(--acc-lt);box-shadow:0 0 0 3px rgba(229,50,62,0.18)}
    .ea-activate-btn{padding:13px 26px;background:linear-gradient(135deg,var(--acc),var(--acc-dk));border:none;border-radius:var(--radius-sm);color:#fff;font-size:0.88rem;font-weight:700;cursor:pointer;transition:all 0.2s;white-space:nowrap;display:flex;align-items:center;gap:8px;font-family:'Sora',sans-serif;box-shadow:0 6px 20px rgba(229,50,62,0.3)}
    .ea-activate-btn:hover{transform:translateY(-2px);box-shadow:0 10px 28px rgba(229,50,62,0.45)}
    .ea-activate-btn:active{transform:scale(0.98)}
    .ea-activate-btn i{font-size:1rem}

    .ea-slot-bar-wrap{padding:0 22px 20px;display:flex;align-items:center;gap:12px}
    .ea-slot-bar{flex:1;height:7px;background:rgba(255,255,255,0.08);border-radius:5px;overflow:hidden}
    .ea-slot-fill{height:100%;border-radius:5px;background:linear-gradient(90deg,var(--acc-dk),var(--acc));box-shadow:0 0 10px var(--acc-glow);transition:width 0.5s ease}
    .ea-slot-lbl{font-size:0.74rem;color:var(--text-tertiary);white-space:nowrap}
    .ea-slot-lbl strong{color:var(--acc);font-weight:800}

    /* ─── Table card ─── */
    .ea-table-card{background:var(--bg-glass-card);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border:1px solid var(--border-light);border-radius:var(--radius-xl);overflow:hidden;animation:eaFade 0.4s ease 0.2s both;position:relative;transition:border-color 0.25s}
    .ea-table-card::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.22),transparent)}
    .ea-table-card:hover{border-color:var(--border-glow)}
    .ea-table-top{padding:18px 22px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px}
    .ea-table-top h3{font-size:1rem !important;font-weight:700 !important;color:var(--text-primary) !important;margin:0 !important}
    .ea-table-top p{font-size:0.75rem;color:var(--text-tertiary);margin:3px 0 0}
    .ea-result-badge{background:var(--acc-lt);border:1px solid var(--border-glow);border-radius:20px;padding:5px 15px;font-size:0.7rem;font-weight:700;color:var(--acc)}

    .ea-tbl-wrap{overflow-x:auto;border-top:1px solid var(--border-light)}
    .ea-tbl-wrap table{width:100%;border-collapse:collapse;min-width:580px}
    .ea-tbl-wrap thead th{text-align:left;padding:12px 20px;font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.09em;color:var(--text-tertiary);background:rgba(255,255,255,0.02);border-bottom:1px solid var(--border-light);white-space:nowrap}
    .ea-tbl-wrap tbody td{padding:14px 20px;font-size:0.84rem;color:var(--text-secondary);border-bottom:1px solid rgba(255,255,255,0.04);vertical-align:middle}
    .ea-tbl-wrap tbody tr:last-child td{border-bottom:none}
    .ea-tbl-wrap tbody tr{transition:background 0.15s}
    .ea-tbl-wrap tbody tr:hover{background:rgba(229,50,62,0.06)}

    .ea-av{width:38px;height:38px;border-radius:12px;background:var(--acc-lt);border:1px solid var(--border-glow);display:flex;align-items:center;justify-content:center;font-size:0.72rem;font-weight:800;color:var(--acc);flex-shrink:0;text-transform:uppercase}
    .ea-uc{display:flex;align-items:center;gap:10px}
    .ea-un{font-weight:600;color:var(--text-primary);font-size:0.84rem}
    .ea-email-cell{font-family:'SF Mono','Consolas',monospace;font-size:0.8rem;color:var(--text-secondary);cursor:pointer;transition:color 0.15s}
    .ea-email-cell:hover{color:var(--acc)}

    .ea-badge{display:inline-flex;align-items:center;gap:6px;padding:5px 13px;border-radius:20px;font-size:0.67rem;font-weight:700;text-transform:uppercase;letter-spacing:0.03em}
    .ea-dot{width:6px;height:6px;border-radius:50%}
    .b-active{background:var(--grn-lt);color:var(--grn);border:1px solid rgba(52,211,153,0.25)}
    .b-active .ea-dot{background:var(--grn);box-shadow:0 0 6px rgba(52,211,153,0.5)}
    .ea-badge.b-unused{background:var(--amb-lt);color:var(--amb);border:1px solid rgba(251,191,36,0.25)}
    .ea-badge.b-unused .ea-dot{background:var(--amb);box-shadow:0 0 6px rgba(251,191,36,0.5)}

    .ea-date{font-size:0.78rem;color:var(--text-secondary);white-space:nowrap}
    .ea-date-sub{font-size:0.66rem;color:var(--text-tertiary);display:block;margin-top:1px}

    .ea-acts{display:flex;gap:6px;justify-content:flex-end}
    .ea-act{padding:6px 13px;border-radius:8px;font-size:0.71rem;font-weight:700;cursor:pointer;border:1px solid;display:inline-flex;align-items:center;gap:5px;transition:all 0.15s;text-decoration:none}
    .act-edit{background:var(--acc-lt);color:var(--acc);border-color:var(--border-glow)}
    .act-edit:hover{background:var(--acc);color:#fff;border-color:var(--acc)}
    .act-rm{background:rgba(239,68,68,0.08);color:#EF4444;border-color:rgba(239,68,68,0.25)}
    .act-rm:hover{background:#EF4444;color:#fff;border-color:#EF4444}
    .th-r,.td-r{text-align:right !important}

    .ea-empty{padding:56px 28px;text-align:center}
    .ea-empty-icon{width:64px;height:64px;border-radius:50%;background:var(--acc-lt);border:1px solid var(--border-glow);display:flex;align-items:center;justify-content:center;margin:0 auto 16px;color:var(--acc);font-size:1.6rem}
    .ea-empty h4{font-size:1rem;font-weight:700;color:var(--text-primary);margin-bottom:6px}
    .ea-empty p{font-size:0.86rem;color:var(--text-tertiary);margin:0}

    /* ─── Modals ─── */
    .ea-modal-overlay{position:fixed;inset:0;background:rgba(5,2,3,0.7);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);z-index:10000;display:none;align-items:center;justify-content:center;opacity:0;transition:opacity 0.25s ease}
    .ea-modal-overlay.show{display:flex;opacity:1}
    .ea-modal{background:linear-gradient(180deg,var(--bg-secondary),#0d0609);border:1px solid var(--border-medium);border-radius:var(--radius-xl);width:420px;max-width:92vw;padding:0;overflow:hidden;transform:scale(0.95) translateY(10px);transition:transform 0.25s cubic-bezier(0.175,0.885,0.32,1.275);box-shadow:var(--shadow-lg),var(--shadow-glow);position:relative}
    .ea-modal::before{content:'';position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(229,50,62,0.7),transparent)}
    .ea-modal-overlay.show .ea-modal{transform:scale(1) translateY(0)}
    .ea-modal-hdr{padding:28px 28px 0;text-align:center}
    .ea-modal-icon{width:60px;height:60px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;font-size:1.45rem}
    .mi-danger{background:rgba(239,68,68,0.12);color:#EF4444;border:1px solid rgba(239,68,68,0.3)}
    .mi-slots{background:var(--acc-lt);color:var(--acc);border:1px solid var(--border-glow);box-shadow:0 0 20px rgba(229,50,62,0.2)}
    .ea-modal-hdr h4{font-size:1.08rem;font-weight:800;color:var(--text-primary);margin:0 0 7px}
    .ea-modal-hdr p{font-size:0.84rem;color:var(--text-secondary);margin:0;line-height:1.5}
    .ea-modal-key{font-family:monospace;font-size:0.74rem;background:rgba(255,255,255,0.05);border:1px solid var(--border-medium);border-radius:8px;padding:8px 14px;display:inline-block;margin-top:12px;color:var(--text-secondary);word-break:break-all;max-width:100%}
    .ea-modal-acts{padding:22px 28px 28px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap}
    .ea-modal-btn{padding:11px 24px;border-radius:12px;font-size:0.85rem;font-weight:700;border:1px solid;cursor:pointer;transition:all 0.2s;min-width:100px;text-align:center;font-family:'Sora',sans-serif}
    .mb-cancel{background:transparent;color:var(--text-secondary);border-color:var(--border-medium)}
    .mb-cancel:hover{background:rgba(255,255,255,0.05);color:var(--text-primary)}
    .mb-danger{background:#EF4444;color:#fff;border-color:#EF4444}
    .mb-danger:hover{background:#dc2626;box-shadow:0 4px 16px rgba(239,68,68,0.4)}

    .slot-pkgs{display:flex;flex-direction:column;gap:10px;padding:16px 28px 0;width:100%}
    .pkg{background:rgba(255,255,255,0.04);border:1px solid var(--border-light);border-radius:var(--radius-md);padding:14px 18px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;transition:all 0.2s;text-decoration:none}
    .pkg:hover{border-color:var(--acc);background:var(--acc-lt);transform:translateY(-1px)}
    .pkg-info strong{font-size:0.88rem;font-weight:700;color:var(--text-primary)}
    .pkg-info span{font-size:0.72rem;color:var(--text-tertiary);display:block;margin-top:1px}
    .pkg-badge{font-size:0.62rem;font-weight:800;background:var(--acc-lt);color:var(--acc);border:1px solid var(--border-glow);padding:2px 9px;border-radius:20px;margin-top:4px;display:inline-block}
    .pkg-price{font-size:0.92rem;font-weight:800;color:var(--acc);font-family:'Sora',sans-serif}

    /* ─── Toast / scroll nav ─── */
    .ea-toast{position:fixed;bottom:28px;right:28px;background:var(--bg-secondary);border:1px solid var(--border-glow);border-radius:var(--radius-md);padding:14px 20px;font-size:0.83rem;font-weight:600;color:var(--text-primary);box-shadow:0 8px 30px rgba(0,0,0,0.5),0 0 24px rgba(229,50,62,0.15);z-index:9999;display:flex;align-items:center;gap:10px;opacity:0;transform:translateY(10px);transition:all 0.3s cubic-bezier(0.175,0.885,0.32,1.275);pointer-events:none}
    .ea-toast.show{opacity:1;transform:translateY(0);pointer-events:auto}
    .ea-toast-dot{width:8px;height:8px;border-radius:50%;background:var(--acc);box-shadow:0 0 8px var(--acc);flex-shrink:0}

    .ea-scroll-nav{position:fixed;right:24px;bottom:24px;display:flex;flex-direction:column;gap:8px;z-index:999}
    .ea-scroll-btn{width:42px;height:42px;border-radius:50%;background:var(--bg-glass-card);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid var(--border-medium);box-shadow:0 4px 16px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:all 0.2s;color:var(--text-secondary);font-size:1rem;opacity:0;transform:scale(0.8);pointer-events:none}
    .ea-scroll-btn.visible{opacity:1;transform:scale(1);pointer-events:auto}
    .ea-scroll-btn:hover{background:var(--acc);color:#fff;border-color:var(--acc);box-shadow:0 6px 20px var(--acc-glow);transform:scale(1.08)}

    @keyframes eaFade{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}

    /* ─── Footer ─── */
    .ios-footer{background:rgba(22,10,13,0.8);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);border-top:1px solid rgba(255,255,255,0.08);padding:20px 32px;margin-top:auto}
    .footer-content{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:16px}
    .footer-left{display:flex;align-items:center;gap:24px;flex-wrap:wrap}
    .footer-brand{display:flex;align-items:center;gap:8px;font-size:15px;font-weight:700;color:rgba(255,255,255,0.9);font-family:'Sora',sans-serif}
    .footer-brand i{color:var(--acc);font-size:20px}
    .footer-brand span{color:var(--acc)}
    .footer-copy{font-size:13px;color:rgba(255,255,255,0.5)}
    .footer-status{display:flex;align-items:center;gap:8px;padding:8px 16px;background:rgba(52,211,153,0.1);border:1px solid rgba(52,211,153,0.22);border-radius:50px;font-size:13px;font-weight:600;color:var(--grn)}
    .status-dot{width:8px;height:8px;background:var(--grn);border-radius:50%;animation:pulse-status 2s ease-in-out infinite;box-shadow:0 0 8px rgba(52,211,153,0.6)}
    @keyframes pulse-status{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.6;transform:scale(1.2)}}
    .footer:not(.ios-footer){display:none !important}
    @media(max-width:576px){
      .ios-footer{padding:16px 20px}
      .footer-content{flex-direction:column;text-align:center}
      .footer-left{flex-direction:column;gap:8px}
      .ea-stats{flex-direction:column}
      .ea-modal{width:95vw}
      .ea-scroll-nav{right:16px;bottom:16px}
    }
  
/* === Shared TradeNest portal shell (matches Generate Key) === */
:root{
 --ink:oklch(0.15 0.008 180); --rail:oklch(0.17 0.008 180 / .86); --panel:oklch(0.26 0.008 180 / .50); --panel-alt:oklch(0.32 0.012 180 / .62);
 --amber:oklch(0.84 0.13 85); --amber-dim:oklch(0.84 0.13 85 / .12); --amber-line:oklch(0.84 0.13 85 / .3);
 --long:oklch(0.85 0.12 165); --long-dim:oklch(0.85 0.12 165 / .1); --short:oklch(0.77 0.14 24); --short-dim:oklch(0.77 0.14 24 / .1); --slate:oklch(0.79 0.1 230); --slate-dim:oklch(0.79 0.1 230 / .1);
 --text-hi:oklch(0.96 0.006 170); --text-mid:oklch(0.73 0.012 170); --text-low:oklch(0.65 0.014 170); --line:oklch(0.98 0 0 / .09); --line-strong:oklch(0.98 0 0 / .18);
 --shadow:0 18px 44px oklch(0.08 0 0 / .22); --glass-shine:linear-gradient(135deg,oklch(0.98 0 0 / .10),transparent 55%);
 --canvas:linear-gradient(125deg,oklch(0.24 0.026 165 / .55),transparent 43%),linear-gradient(315deg,oklch(0.25 0.025 85 / .25),transparent 60%);
 --sidebar-width:252px; --font-display:'Space Grotesk',sans-serif; --font-mono:'JetBrains Mono',monospace;
}
*{box-sizing:border-box;margin:0;padding:0;letter-spacing:0!important}
body{background:var(--ink);color:var(--text-hi);font-family:var(--font-display);line-height:1.6;min-height:100vh;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
button{font:inherit}
a:focus-visible,button:focus-visible{outline:2px solid var(--long);outline-offset:4px}
.ios-bg-grid{position:fixed;inset:0;pointer-events:none;background:var(--canvas);z-index:-1}
.ios-edge-glow{display:none}
.container-scroller,.page-body-wrapper{background:transparent;min-height:100vh}
.navbar{position:fixed;top:0;left:var(--sidebar-width);right:0;height:76px;background:var(--rail);backdrop-filter:blur(24px);border-bottom:1px solid var(--line);z-index:100;padding:0 40px}
.navbar-menu-wrapper{display:flex;align-items:center;justify-content:space-between;width:100%;height:100%;gap:16px}
.topbar-path{font-size:13px;color:var(--text-mid);display:flex;gap:12px;align-items:center}
.topbar-path b{color:var(--text-hi);font-weight:500}
.topbar-account{display:flex;gap:12px;align-items:center;font-size:12px;color:var(--text-mid)}
.topbar-account i{font-size:20px;color:var(--long)}
.mobile-menu-btn{display:none;width:40px;height:40px;border:1px solid var(--line-strong);background:var(--panel);border-radius:8px;color:var(--text-hi);cursor:pointer;align-items:center;justify-content:center;font-size:23px;flex-shrink:0}
.sidebar{position:fixed;inset:0 auto 0 0;width:var(--sidebar-width);height:100dvh;background:var(--rail);backdrop-filter:blur(28px);border-right:1px solid var(--line);z-index:200;display:flex;flex-direction:column;transition:transform .25s ease}
.sidebar-brand{display:flex;align-items:center;gap:12px;padding:28px 23px 26px;flex-shrink:0}
.sidebar-brand-icon{width:38px;height:38px;background:var(--panel);border:1px solid var(--line-strong);border-radius:8px;overflow:hidden;flex-shrink:0}
.sidebar-brand-icon img{width:100%;height:100%;object-fit:cover}
.sidebar-brand-text{font-size:22px;font-weight:700;line-height:1.2}
.sidebar-brand-text span{color:var(--long)}
.sidebar-brand-tag{font-size:9px;color:var(--text-low);margin-top:6px}
.sidebar-profile{padding:0 16px 20px}
.sidebar-profile-card{display:flex;gap:10px;align-items:center;padding:12px;background:var(--glass-shine),var(--panel);border:1px solid var(--line);border-radius:8px}
.sidebar-profile-card:hover{border-color:var(--line-strong)}
.sidebar-profile-avatar,.sidebar-profile-avatar-placeholder{width:36px;height:36px;border-radius:8px;object-fit:cover;flex-shrink:0}
.sidebar-profile-avatar-placeholder{background:var(--long-dim);color:var(--long);display:grid;place-items:center;font-weight:700}
.sidebar-profile-info{min-width:0;flex:1}
.sidebar-profile-name{font-size:11px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sidebar-profile-role{color:var(--text-low);font-size:10px;margin-top:2px}
.sidebar .nav{list-style:none;overflow:auto;flex:1;padding:0 14px;scrollbar-width:thin}
.nav-item{list-style:none;margin:4px 0}
.nav-link{display:flex;align-items:center;gap:12px;padding:11px 13px;border:1px solid transparent;border-radius:8px;color:var(--text-mid);font-size:13px;transition:background .2s,color .2s}
.nav-link:hover{background:var(--panel);color:var(--text-hi)}
.nav-item.active .nav-link{background:var(--long-dim);color:var(--long);border-color:var(--line)}
.nav-link i{font-size:19px;width:21px;text-align:center}
.nav-link-code{display:none}
.nav-section-title{list-style:none;font-size:10px;color:var(--text-low);padding:23px 13px 8px;text-transform:uppercase}
.sidebar-logout{padding:18px;border-top:1px solid var(--line);margin-top:auto}
.sidebar-logout-btn{display:flex;gap:12px;align-items:center;padding:10px 12px;color:var(--text-mid);font-size:13px}
.sidebar-logout-btn:hover{color:var(--short)}
.sidebar-logout-btn i{font-size:19px}
.main-panel{margin-left:var(--sidebar-width);width:calc(100% - var(--sidebar-width));min-height:100vh;display:flex;flex-direction:column}
.content-wrapper{padding:116px 40px 40px;flex:1;max-width:1600px;width:100%;margin:auto}
.ios-footer{border-top:1px solid var(--line);padding:22px 40px;margin-top:36px}
.footer-content,.footer-left{display:flex;align-items:center;justify-content:space-between;gap:20px}
.footer-brand{font-size:12px;color:var(--text-mid);display:flex;gap:5px;align-items:center}
.footer-brand i,.footer-brand span{color:var(--long)}
.footer-copy{font-size:10px;color:var(--text-low)}
.footer-status{font-size:10px;color:var(--text-low);display:flex;align-items:center;gap:7px}
.sidebar-overlay{position:fixed;inset:0;background:oklch(0.08 0 0 / .65);backdrop-filter:blur(5px);z-index:190;visibility:hidden;opacity:0;transition:opacity .25s}
.sidebar-overlay.active{visibility:visible;opacity:1}
@media(max-width:1200px){.content-wrapper{padding-left:26px;padding-right:26px}.navbar{padding:0 26px}}
@media(max-width:991px){.sidebar{transform:translateX(-100%)}.sidebar.sidebar-open{transform:translateX(0)}.main-panel{margin-left:0;width:100%}.navbar{left:0;height:68px;padding:0 22px}.mobile-menu-btn{display:flex}.topbar-path{margin-right:auto}.topbar-path>span{display:none}.content-wrapper{padding-top:100px}}
@media(max-width:600px){.navbar{padding:0 18px}.topbar-account span{display:none}.content-wrapper{padding:94px 20px 24px}.ios-footer{padding:22px 20px}.footer-content{align-items:flex-start}.footer-left{align-items:flex-start;flex-direction:column;gap:7px}.footer-copy{font-size:9px}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
:root{--ink:#0d0d10;--rail:rgba(17,17,22,.9);--panel:rgba(35,35,42,.57);--panel-alt:rgba(52,52,62,.74);--brand:#ff3048;--brand-bright:#ff6578;--brand-dim:rgba(255,48,72,.12);--brand-line:rgba(255,64,86,.34);--long:var(--brand-bright);--long-dim:var(--brand-dim);--text-hi:#f5f4f8;--text-mid:#b8b7c3;--text-low:#9493a1;--line:rgba(235,235,255,.09);--line-strong:rgba(235,235,255,.17);--slate:#85cde5;--amber:#f4cc85;--brand-glow:0 0 28px rgba(255,48,72,.17);--shadow:0 20px 50px rgba(0,0,0,.32);--glass-shine:linear-gradient(120deg,rgba(255,255,255,.07),transparent 60%);--canvas:linear-gradient(145deg,rgba(117,17,40,.24),transparent 48%);--ticket-shade:linear-gradient(90deg,rgba(13,13,16,.98),rgba(13,13,16,.9) 40%,rgba(13,13,16,.65));--ticket-lines:repeating-linear-gradient(110deg,transparent,transparent 14px,rgba(255,48,72,.12) 14px,rgba(255,48,72,.12) 15px)}
.sidebar{border-right-color:var(--brand-line)}
.sidebar-brand-icon{box-shadow:var(--brand-glow);border-color:var(--brand-line);display:grid;place-items:center;color:var(--brand);font-size:23px}
.sidebar-brand-icon>*{grid-area:1/1}
.nav-item.active .nav-link{border-color:var(--brand-line);box-shadow:inset 3px 0 var(--brand),var(--brand-glow)}
.content-wrapper{max-width:1560px;padding-top:108px}
.navbar{height:72px}
@media(max-width:991px){.content-wrapper{padding-top:100px}}
@media(max-width:700px){.content-wrapper{padding:98px 18px 24px}.topbar-account span{display:none}}
body{font-family:var(--font-display)!important;background:var(--ink)!important}
h1,h2,h3,h4,.sidebar-brand-text,.ea-activate-btn,.ea-modal-btn,.pkg-price,.footer-brand{font-family:var(--font-display)!important}
.ios-bg-animation{display:none!important}
</style>
</head>

<body>
  <div class="sidebar-overlay" id="sidebarOverlay"></div>

  <div class="ios-bg-animation">
    <div class="ios-bg-orb ios-bg-orb-1"></div>
    <div class="ios-bg-orb ios-bg-orb-2"></div>
    <div class="ios-bg-orb ios-bg-orb-3"></div>
  </div>
  <div class="ios-bg-grid"></div>
  <div class="ios-edge-glow ios-edge-glow-left"></div>

  <div class="container-scroller">

    <!-- Navbar: live ticker strip -->
    <nav class="navbar col-lg-12 col-12 p-0 fixed-top d-flex flex-row">
      <div class="navbar-menu-wrapper d-flex align-items-center w-100">
        <button type="button" class="mobile-menu-btn" id="mobileMenuBtn" aria-label="Open menu" aria-controls="sidebar" aria-expanded="false">
          <i class="mdi mdi-menu" aria-hidden="true"></i>
        </button>
        <div class="topbar-path"><span>Workspace</span><i class="mdi mdi-chevron-right" aria-hidden="true"></i><b>Email Activation</b></div>
        <a class="topbar-account" href="index.php"><i class="mdi mdi-arrow-left" aria-hidden="true"></i><span>Back to dashboard</span></a>
      </div>
    </nav>

    <div class="container-fluid page-body-wrapper">

      <!-- Sidebar -->
      <nav class="sidebar sidebar-offcanvas" id="sidebar">
        <div class="sidebar-brand">
          <div class="sidebar-brand-icon"><i class="mdi mdi-lightning-bolt" aria-hidden="true"></i><img src="images1/logo.jpeg" alt="TradeNest" onerror="this.remove()"></div>
          <div>
            <div class="sidebar-brand-text">Trade <span>Nest</span></div>
            <div class="sidebar-brand-tag">MENTOR COMMAND</div>
          </div>
        </div>

        <div class="sidebar-profile">
          <a href="profile.php" class="sidebar-profile-card">
            <?php if (!empty($picture_url)): ?>
              <img src="<?= htmlspecialchars($picture_url) ?>" alt="Profile" class="sidebar-profile-avatar">
            <?php else: ?>
              <div class="sidebar-profile-avatar-placeholder">
                <?= strtoupper(substr($display_name ?: 'U', 0, 1)) ?>
              </div>
            <?php endif; ?>
            <div class="sidebar-profile-info">
              <div class="sidebar-profile-name"><?= htmlspecialchars($email) ?></div>
              <div class="sidebar-profile-role">MENTOR</div>
            </div>
            <i class="mdi mdi-chevron-right" style="color:var(--text-low);font-size:18px;"></i>
          </a>
        </div>

        <ul class="nav">
          <li class="nav-item">
            <a class="nav-link" href="index.php">
              <i class="mdi mdi-view-dashboard menu-icon"></i><span class="menu-title">Dashboard</span>
              <span class="nav-link-code">DASH</span>
            </a>
          </li>
          <li class="nav-item">
            <a class="nav-link" href="key.php">
              <i class="mdi mdi-key-variant menu-icon"></i><span class="menu-title">Generate Key</span>
              <span class="nav-link-code">KEY</span>
            </a>
          </li>
          <li class="nav-item">
            <a class="nav-link" href="EA.php">
              <i class="mdi mdi-robot menu-icon"></i><span class="menu-title">Manage EAs</span>
              <span class="nav-link-code">EA</span>
            </a>
          </li>
          <li class="nav-section-title">Management</li>
          <li class="nav-item">
            <a class="nav-link" href="manage_users.php">
              <i class="mdi mdi-information-outline menu-icon"></i><span class="menu-title">My Users</span>
              <span class="nav-link-code">USR</span>
            </a>
          </li>
          <li class="nav-item active">
            <a class="nav-link" href="licences.php">
              <i class="mdi mdi-email-check-outline menu-icon"></i><span class="menu-title">Email Activation</span>
              <span class="nav-link-code">ACT</span>
            </a>
          </li>
          <li class="nav-item">
            <a class="nav-link" href="stats.php">
              <i class="mdi mdi-chart-line menu-icon"></i><span class="menu-title">Key Stats</span>
              <span class="nav-link-code">STAT</span>
            </a>
          </li>
          <li class="nav-section-title">Trading</li>
          <li class="nav-item">
            <a class="nav-link" href="copy_trading.php">
              <i class="mdi mdi-swap-horizontal-bold menu-icon"></i><span class="menu-title">Copy Trading</span>
              <span class="nav-link-code">COPY</span>
            </a>
          </li>
        </ul>

        <div class="sidebar-logout">
          <a href="../php-includes/logout.php" class="sidebar-logout-btn">
            <i class="mdi mdi-logout"></i><span>Log out</span>
          </a>
        </div>
      </nav>

      <!-- Main Panel -->
      <div class="main-panel">
        <div class="content-wrapper">

          <script>
          (function(){
            var sidebar = document.getElementById('sidebar');
            var overlay = document.getElementById('sidebarOverlay');
            var menuBtn = document.getElementById('mobileMenuBtn');
            function openSidebar(){if(sidebar)sidebar.classList.add('sidebar-open');if(overlay)overlay.classList.add('active');document.body.style.overflow='hidden'}
            function closeSidebar(){if(sidebar)sidebar.classList.remove('sidebar-open');if(overlay)overlay.classList.remove('active');document.body.style.overflow=''}
            function toggleSidebar(e){if(e){e.preventDefault();e.stopPropagation()}sidebar&&sidebar.classList.contains('sidebar-open')?closeSidebar():openSidebar()}
            if(menuBtn){
              menuBtn.addEventListener('touchstart',function(e){e.preventDefault();toggleSidebar(e)},{passive:false});
              menuBtn.addEventListener('click',function(e){toggleSidebar(e)});
              menuBtn.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();toggleSidebar(e)}});
            }
            if(overlay){
              overlay.addEventListener('touchstart',function(e){e.preventDefault();closeSidebar()},{passive:false});
              overlay.addEventListener('click',function(){closeSidebar()});
            }
            document.querySelectorAll('.sidebar .nav-link').forEach(function(link){link.addEventListener('click',function(){if(window.innerWidth<=991)setTimeout(closeSidebar,100)})});
            document.addEventListener('keydown',function(e){if(e.key==='Escape'&&sidebar&&sidebar.classList.contains('sidebar-open'))closeSidebar()});
            window.addEventListener('resize',function(){if(window.innerWidth>991&&sidebar&&sidebar.classList.contains('sidebar-open'))closeSidebar()});
          })();
          </script>

          <div class="ea-page">

            <div class="ea-hdr">
              <div>
                <h2>Email Activations</h2>
                <p>Paid clients and mentor-funded email activations</p>
              </div>
              <div class="owner-badge"><span>Owner ID</span> #<?= $owner_id ?></div>
            </div>

            <div class="ea-stats">
              <div class="ea-stat">
                <div class="ea-stat-icon ic-grn"><i class="mdi mdi-credit-card-check"></i></div>
                <div class="ea-stat-data"><h4><?= $paid_count === null ? 'Unavailable' : $paid_count ?></h4><span>Paid Emails</span></div>
              </div>
              <div class="ea-stat" style="animation-delay:0.04s">
                <div class="ea-stat-icon ic-red"><i class="mdi mdi-database"></i></div>
                <div class="ea-stat-data"><h4><?= $total_slots ?></h4><span>Total Slots</span></div>
              </div>
              <div class="ea-stat" style="animation-delay:0.08s">
                <div class="ea-stat-icon ic-grn"><i class="mdi mdi-account-check"></i></div>
                <div class="ea-stat-data"><h4><?= $used_slots ?></h4><span>Used Slots</span></div>
              </div>
              <div class="ea-stat" style="animation-delay:0.12s">
                <div class="ea-stat-icon ic-amb"><i class="mdi mdi-circle-outline"></i></div>
                <div class="ea-stat-data"><h4><?= $remaining ?></h4><span>Remaining</span></div>
              </div>
            </div>

            <!-- Activate card (always visible) -->
            <div class="ea-activate-card">
              <div class="ea-card-top">
                <div class="ea-card-top-ic"><i class="mdi mdi-email-fast-outline"></i></div>
                <div>
                  <h3>Activate Email</h3>
                  <p>Enter a client email address to consume one slot</p>
                </div>
              </div>

              <div class="ea-activate-body">
                <form id="activateForm" method="POST" action="activate_mail.php">
                  <input type="hidden" name="admin_id" value="<?= $_SESSION['admin_id'] ?>">
                  <div class="ea-inp-wrap">
                    <i class="mdi mdi-email-outline"></i>
                    <input type="email" name="email" class="ea-email-inp" id="emailInp" placeholder="client@example.com" required>
                  </div>
                  <button class="ea-activate-btn" type="submit">
                    <i class="mdi mdi-lightning-bolt"></i> Activate Email
                  </button>
                </form>
              </div>

              <div class="ea-slot-bar-wrap">
                <div class="ea-slot-bar">
                  <div class="ea-slot-fill"
                    style="width:<?= $total_slots > 0 ? round(($remaining / $total_slots) * 100) : 0 ?>%;<?= $remaining <= 0 ? 'background:#EF4444;box-shadow:0 0 10px rgba(239,68,68,0.5);' : '' ?>">
                  </div>
                </div>
                <span class="ea-slot-lbl">
                  <strong<?= $remaining <= 0 ? ' style="color:#EF4444;"' : '' ?>><?= $remaining ?></strong> of <?= $total_slots ?> slots remaining
                </span>
              </div>
            </div>

            <!-- Table Card -->
            <div class="ea-table-card">
              <div class="ea-table-top">
                <div>
                  <h3>Activated Emails</h3>
                  <p>Showing <?= $emails_result->num_rows ?> records</p>
                </div>
                <span class="ea-result-badge"><?= $emails_result->num_rows ?> emails</span>
              </div>

              <div class="ea-tbl-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>User</th><th>Email</th><th>Status</th><th>Joined</th><th class="th-r">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                  <?php if($emails_result->num_rows==0): ?>
                    <tr>
                      <td colspan="5">
                        <div class="ea-empty">
                          <div class="ea-empty-icon"><i class="mdi mdi-email-off-outline"></i></div>
                          <h4>No emails found</h4>
                          <p>Activate your first client email above.</p>
                        </div>
                      </td>
                    </tr>
                  <?php else: ?>
                    <?php while($row=$emails_result->fetch_assoc()):
                      $rowEmail = htmlspecialchars($row['email']);
                      $init  = strtoupper(substr($rowEmail,0,2));
                      $date  = date("d M Y",strtotime($row['created_at']));
                      $time  = date("H:i",strtotime($row['created_at']));
                    ?>
                    <tr id="row-<?= $row['id'] ?>">
                      <td>
                        <div class="ea-uc">
                          <div class="ea-av"><?= $init ?></div>
                          <div class="ea-un">Client</div>
                        </div>
                      </td>
                      <td class="ea-email-cell" onclick="copyEmail('<?= $rowEmail ?>')" title="Click to copy"><?= $rowEmail ?></td>
                      <td>
                        <?php if ((int)$row['has_logged_in'] === 1): ?>
                          <span class="ea-badge b-active"><span class="ea-dot"></span>Used</span>
                        <?php else: ?>
                          <span class="ea-badge b-unused"><span class="ea-dot"></span>Unused</span>
                        <?php endif; ?>
                      </td>
                      <td>
                        <span class="ea-date"><?= $date ?><span class="ea-date-sub"><?= $time ?></span></span>
                      </td>
                      <td class="td-r">
                        <div class="ea-acts">
                          <?php if ((int)$row['has_logged_in'] === 1): ?>
                            <a href="deactivate_email.php?id=<?= $row['id'] ?>" class="ea-act act-edit"><i class="ti-control-pause"></i>Deactivate</a>
                          <?php else: ?>
                            <a href="activate_email.php?id=<?= $row['id'] ?>" class="ea-act act-edit"><i class="ti-control-play"></i>Activate</a>
                          <?php endif; ?>
                          <a href="delete_email.php?id=<?= $row['id'] ?>" class="ea-act act-rm" onclick="return confirm('Delete this email permanently?');">
                            <i class="ti-trash"></i>Delete
                          </a>
                        </div>
                      </td>
                    </tr>
                    <?php endwhile; ?>
                  <?php endif; ?>
                  </tbody>
                </table>
              </div>
            </div>

          </div><!-- /ea-page -->
        </div><!-- /content-wrapper -->

        <footer class="ios-footer">
          <div class="footer-content">
            <div class="footer-left">
              <span class="footer-brand"><i class="mdi mdi-robot"></i>Trade<span>Nest</span></span>
              <span class="footer-copy">&copy; 2026 All rights reserved.</span>
            </div>
            <div class="footer-right">
              <span class="footer-status"><span class="status-dot"></span>Systems Online</span>
            </div>
          </div>
        </footer>

      </div>
    </div>
  </div>

  <!-- Remove Confirmation Modal -->
  <div class="ea-modal-overlay" id="removeModal">
    <div class="ea-modal">
      <div class="ea-modal-hdr">
        <div class="ea-modal-icon mi-danger"><i class="mdi mdi-account-remove"></i></div>
        <h4>Remove Activation</h4>
        <p>This will immediately deactivate access for this email. The slot will be freed.</p>
        <div class="ea-modal-key" id="removeEmailDisplay"></div>
      </div>
      <div class="ea-modal-acts">
        <button class="ea-modal-btn mb-cancel" onclick="closeModal('removeModal')">Cancel</button>
        <button class="ea-modal-btn mb-danger" onclick="confirmRemove()"><i class="mdi mdi-trash-can-outline" style="font-size:0.95rem;margin-right:4px;vertical-align:-1px"></i>Remove</button>
      </div>
    </div>
  </div>

  <!-- No Slots / Payment Plan Modal -->
  <div class="ea-modal-overlay" id="slotsModal">
    <div class="ea-modal">
      <div class="ea-modal-hdr">
        <div class="ea-modal-icon mi-slots"><i class="mdi mdi-database-off"></i></div>
        <h4>No Slots Remaining</h4>
        <p>Purchase more activation slots to continue adding client emails.</p>
      </div>
      <div class="slot-pkgs">
        <a href="buy_slots.php?package=2" class="pkg">
          <div class="pkg-info"><strong>2 Slots</strong><span>Great for small client lists</span></div>
          <div class="pkg-price">R1000</div>
        </a>
        <a href="buy_slots.php?package=5" class="pkg">
          <div class="pkg-info"><strong>5 Slots</strong><span>For growing client lists</span></div>
          <div class="pkg-price">R3200</div>
        </a>
        <a href="buy_slots.php?package=10" class="pkg" style="border-color:var(--border-glow);background:var(--acc-lt);">
          <div class="pkg-info"><strong>10 Slots</strong><span>Most popular</span><span class="pkg-badge">Best value</span></div>
          <div class="pkg-price">R6500</div>
        </a>
      </div>
      <div class="ea-modal-acts">
        <button class="ea-modal-btn mb-cancel" onclick="closeModal('slotsModal')">Maybe later</button>
      </div>
    </div>
  </div>

  <!-- Toast -->
  <div class="ea-toast" id="eaToast">
    <div class="ea-toast-dot"></div>
    <span id="eaToastMsg"></span>
  </div>

  <div class="ea-scroll-nav">
    <div class="ea-scroll-btn" id="eaScrollUp" onclick="window.scrollTo({top:0,behavior:'smooth'})" title="Top">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"></polyline></svg>
    </div>
    <div class="ea-scroll-btn" id="eaScrollDown" onclick="window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'})" title="Bottom">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
    </div>
  </div>

  <script src="vendors/js/vendor.bundle.base.js"></script>
  <script src="js/off-canvas.js"></script>
  <script src="js/hoverable-collapse.js"></script>
  <script src="js/template.js"></script>
  <script src="js/settings.js"></script>

  <script>
  /* Expose remaining slots to JS */
  var REMAINING_SLOTS = <?= (int)$remaining ?>;

  var _removeId = null, _removeEmail = null;

  function showToast(msg){
    var t = document.getElementById('eaToast');
    var m = document.getElementById('eaToastMsg');
    if(!t||!m) return;
    m.textContent = msg;
    t.classList.add('show');
    clearTimeout(window._eatt);
    window._eatt = setTimeout(function(){ t.classList.remove('show'); },2800);
  }

  function openModal(id){ var el=document.getElementById(id); if(el) el.classList.add('show'); }
  function closeModal(id){ var el=document.getElementById(id); if(el) el.classList.remove('show'); }

  ['removeModal','slotsModal'].forEach(function(id){
    var el = document.getElementById(id);
    if(el) el.addEventListener('click', function(e){ if(e.target===this) closeModal(id); });
  });
  document.addEventListener('keydown', function(e){
    if(e.key==='Escape'){ closeModal('removeModal'); closeModal('slotsModal'); }
  });

  /* Intercept the Activate Email form:
     - If no slots remaining, open the payment plan modal instead of submitting
     - Otherwise ask for confirmation and submit normally */
  (function(){
    var form = document.getElementById('activateForm');
    if(!form) return;
    form.addEventListener('submit', function(e){
      if(REMAINING_SLOTS <= 0){
        e.preventDefault();
        openModal('slotsModal');
        return false;
      }
      if(!confirm('This will use 1 slot. Continue?')){
        e.preventDefault();
        return false;
      }
    });
  })();

  function copyEmail(email){
    try{
      if(navigator.clipboard && window.isSecureContext){
        navigator.clipboard.writeText(email).then(function(){ showToast('Copied: '+email); });
        return;
      }
    }catch(e){}
    var ta=document.createElement('textarea');
    ta.value=email;
    ta.style.cssText='position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;';
    document.body.appendChild(ta); ta.select();
    try{ document.execCommand('copy'); showToast('Copied: '+email); }catch(e){}
    document.body.removeChild(ta);
  }

  function askRemove(id,email){
    _removeId=id; _removeEmail=email;
    document.getElementById('removeEmailDisplay').textContent=email;
    openModal('removeModal');
  }

  async function confirmRemove(){
    if(!_removeId) return;
    closeModal('removeModal');
    try{
      var res=await fetch('remove_email.php',{
        method:'POST',
        headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body:'id='+encodeURIComponent(_removeId)
      });
      var data=await res.json();
      if(data.success){
        var row=document.getElementById('row-'+_removeId);
        if(row) row.remove();
        showToast('Activation removed — slot freed');
      } else {
        showToast(data.msg||'Could not remove activation');
      }
    }catch(err){ showToast('Network error — please try again'); }
    _removeId=null; _removeEmail=null;
  }

  (function(){
    var up=document.getElementById('eaScrollUp');
    var dn=document.getElementById('eaScrollDown');
    if(!up||!dn) return;
    function check(){
      var y=window.pageYOffset||document.documentElement.scrollTop;
      var docH=document.documentElement.scrollHeight;
      var winH=window.innerHeight;
      y<120?up.classList.remove('visible'):up.classList.add('visible');
      y+winH>=docH-120?dn.classList.remove('visible'):dn.classList.add('visible');
    }
    var ticking=false;
    window.addEventListener('scroll',function(){
      if(!ticking){ window.requestAnimationFrame(function(){ check(); ticking=false; }); ticking=true; }
    },{passive:true});
    check();
  })();
  </script>

</body>
</html>