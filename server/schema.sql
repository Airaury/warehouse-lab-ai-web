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

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(60) NOT NULL,
  role ENUM('MANAGER','DEPUTY','OPERATOR','VIEWER') NOT NULL,
  password_hash VARCHAR(180) NOT NULL,
  deleted_at DATETIME NULL DEFAULT NULL,
  active_manager_slot TINYINT GENERATED ALWAYS AS (CASE WHEN role='MANAGER' AND deleted_at IS NULL THEN 1 ELSE NULL END) STORED,
  UNIQUE KEY uq_active_manager (active_manager_slot),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash CHAR(64) NOT NULL PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  expires_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_sessions_expires (expires_at)
);

CREATE TABLE IF NOT EXISTS replenishments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  item_id BIGINT UNSIGNED NOT NULL,
  quantity INT UNSIGNED NOT NULL,
  reason VARCHAR(200) NOT NULL DEFAULT '',
  status ENUM('PENDING','APPROVED','REJECTED','RECEIVED') NOT NULL DEFAULT 'PENDING',
  requested_by BIGINT UNSIGNED NOT NULL,
  reviewed_by BIGINT UNSIGNED NULL,
  received_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TIMESTAMP NULL,
  received_at TIMESTAMP NULL,
  FOREIGN KEY (item_id) REFERENCES items(id),
  FOREIGN KEY (requested_by) REFERENCES users(id),
  FOREIGN KEY (reviewed_by) REFERENCES users(id),
  FOREIGN KEY (received_by) REFERENCES users(id),
  INDEX idx_replenishments_status (status, created_at)
);

CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  audience ENUM('MANAGER','OPERATOR','ALL') NOT NULL,
  title VARCHAR(100) NOT NULL,
  body VARCHAR(240) NOT NULL,
  target_path VARCHAR(100) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_notifications_created (created_at)
);

CREATE TABLE IF NOT EXISTS notification_reads (
  notification_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (notification_id,user_id),
  FOREIGN KEY (notification_id) REFERENCES notifications(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS ai_plan_runs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  created_by BIGINT UNSIGNED NOT NULL,
  plan_json JSON NOT NULL,
  tool_trace JSON NOT NULL,
  snapshot_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_ai_plan_runs_created (snapshot_at)
);

CREATE TABLE IF NOT EXISTS ai_plan_applications (
  plan_id BIGINT UNSIGNED NOT NULL,
  replenishment_id BIGINT UNSIGNED NOT NULL,
  sku VARCHAR(40) NOT NULL,
  PRIMARY KEY (plan_id,sku),
  UNIQUE KEY uq_ai_plan_application_replenishment (replenishment_id),
  FOREIGN KEY (plan_id) REFERENCES ai_plan_runs(id),
  FOREIGN KEY (replenishment_id) REFERENCES replenishments(id)
);

INSERT INTO items (sku,name,category,zone,quantity,min_quantity,unit) VALUES
('A-SENSOR-01','环境传感器','电子元件','A区',86,20,'件'),
('A-MCU-02','微控制器','电子元件','A区',34,20,'件'),
('A-FAN-03','散热风扇','耗材','A区',18,25,'件'),
('B-BAT-01','锂电池组','成品','B区',128,30,'组'),
('C-CABLE-01','数据线','耗材','C区',62,25,'根'),
('D-SHELL-01','设备外壳','结构件','D区',12,20,'件'),
('E-BOARD-01','电路板','电子元件','E区',95,25,'片'),
('A-RES-04','精密电阻包','电子元件','A区',240,60,'包'),
('A-CAP-05','陶瓷电容包','电子元件','A区',180,50,'包'),
('A-LED-06','指示灯模组','电子元件','A区',44,18,'件'),
('A-RELAY-07','继电器模组','电子元件','A区',26,15,'件'),
('B-POWER-02','可调电源模块','设备','B区',17,8,'台'),
('B-CHARGE-03','电池充电器','设备','B区',21,10,'台'),
('B-FUSE-04','保险丝盒','耗材','B区',52,20,'盒'),
('B-ADAPTER-05','电源适配器','设备','B区',36,12,'件'),
('C-USB-02','USB-C连接线','耗材','C区',76,30,'根'),
('C-HDMI-03','HDMI连接线','耗材','C区',33,15,'根'),
('C-JUMPER-04','杜邦线套装','耗材','C区',41,20,'套'),
('C-ETHER-05','网线','耗材','C区',58,20,'根'),
('D-BRACKET-02','铝合金支架','结构件','D区',28,12,'件'),
('D-SCREW-03','螺丝套装','结构件','D区',70,25,'盒'),
('D-CASE-04','防护收纳盒','结构件','D区',16,10,'个'),
('D-HEATSINK-05','散热片','结构件','D区',39,15,'片'),
('E-OLED-02','OLED显示屏','电子元件','E区',23,12,'片'),
('E-MOTOR-03','步进电机','设备','E区',19,10,'台'),
('E-DRIVER-04','电机驱动板','电子元件','E区',31,14,'片'),
('E-RFID-05','RFID读卡模块','电子元件','E区',22,10,'件')
ON DUPLICATE KEY UPDATE id=id;

-- 示例：先以管理员账号执行本文件，再按需创建应用专用用户。
-- CREATE USER 'warehouse_app'@'127.0.0.1' IDENTIFIED BY '自行设置的强密码';
-- GRANT SELECT, INSERT, UPDATE ON ai_warehouse.* TO 'warehouse_app'@'127.0.0.1';
-- GRANT DELETE ON ai_warehouse.sessions TO 'warehouse_app'@'127.0.0.1';

