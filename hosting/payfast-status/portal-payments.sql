-- Run once in the existing mentor portal MySQL database, not Lovable Cloud.
-- Existing subscriptions/admins tables are unchanged.
CREATE TABLE IF NOT EXISTS payfast_client_receipts (
  provider_payment_id VARCHAR(120) NOT NULL PRIMARY KEY,
  payment_id VARCHAR(120) NOT NULL,
  admin_id INT NOT NULL,
  email VARCHAR(254) NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency CHAR(3) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY mentor_email (admin_id, email)
) ENGINE=InnoDB;