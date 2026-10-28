CREATE DATABASE IF NOT EXISTS ai_warehouse CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ai_warehouse;

CREATE TABLE IF NOT EXISTS items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  sku VARCHAR(40) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(60) NOT NULL,
  zone VARCHAR(20) NOT NULL,
  quantity INT UNSIGNED NOT NULL DEFAULT 0,
  min_quantity INT UNSIGNED NOT NULL DEFAULT 20,
  unit VARCHAR(20) NOT NULL DEFAULT '件',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_item_min CHECK (min_quantity <= 1000000)
);

CREATE TABLE IF NOT EXISTS movements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  item_id BIGINT UNSIGNED NOT NULL,
  direction ENUM('IN','OUT') NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  note VARCHAR(200) NOT NULL DEFAULT '',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (item_id) REFERENCES items(id),
  INDEX idx_movements_created (created_at)
);

CREATE TABLE IF NOT EXISTS approvals (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  item_id BIGINT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  note VARCHAR(200) NOT NULL DEFAULT '',
  status ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP NULL DEFAULT NULL,
  FOREIGN KEY (item_id) REFERENCES items(id),
  INDEX idx_approvals_status (status, created_at)
);

INSERT INTO items (sku,name,category,zone,quantity,min_quantity,unit) VALUES
('A-SENSOR-01','环境传感器','电子元件','A区',86,20,'件'),
('A-MCU-02','微控制器','电子元件','A区',34,20,'件'),
('A-FAN-03','散热风扇','耗材','A区',18,25,'件'),
('B-BAT-01','锂电池组','成品','B区',128,30,'组'),
('C-CABLE-01','数据线','耗材','C区',62,25,'根'),
('D-SHELL-01','设备外壳','结构件','D区',12,20,'件'),
('E-BOARD-01','电路板','电子元件','E区',95,25,'片')
ON DUPLICATE KEY UPDATE id=id;

-- 示例：先以管理员账号执行本文件，再按需创建应用专用用户。
-- CREATE USER 'warehouse_app'@'127.0.0.1' IDENTIFIED BY '自行设置的强密码';
-- GRANT SELECT, INSERT, UPDATE ON ai_warehouse.* TO 'warehouse_app'@'127.0.0.1';

