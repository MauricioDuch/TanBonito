-- Tan Bonito — esquema inicial

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS suppliers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  contact VARCHAR(150) NULL,
  notes VARCHAR(255) NULL
);

-- Insumos. El precio unitario se calcula: package_price / package_qty
CREATE TABLE IF NOT EXISTS supplies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  unit VARCHAR(20) NOT NULL,                 -- g, ml, unidad, cm...
  package_qty DECIMAL(12,3) NOT NULL,        -- p. ej. 1000 (g)
  package_price DECIMAL(12,2) NOT NULL,      -- p. ej. 8500 ($ por el kilo)
  supplier_id INT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL
);

-- Productos con su receta (mano de obra y packaging por unidad)
CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  labor_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  packaging_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
  sale_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS recipe_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  supply_id INT NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (supply_id) REFERENCES supplies(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS scents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(80) NOT NULL,
  seasonal TINYINT(1) NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS sales (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sale_date DATE NOT NULL,
  product_id INT NOT NULL,
  scent_id INT NULL,
  quantity INT NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  total DECIMAL(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  payment_method ENUM('efectivo','mercadopago','tarjeta','transferencia') NOT NULL,
  channel ENUM('feria','online') NOT NULL DEFAULT 'feria',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT,
  FOREIGN KEY (scent_id) REFERENCES scents(id) ON DELETE SET NULL,
  INDEX idx_sales_date (sale_date)
);

CREATE TABLE IF NOT EXISTS purchases (
  id INT AUTO_INCREMENT PRIMARY KEY,
  purchase_date DATE NOT NULL,
  supply_id INT NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  price DECIMAL(12,2) NOT NULL,              -- total pagado
  supplier_id INT NULL,
  FOREIGN KEY (supply_id) REFERENCES supplies(id) ON DELETE RESTRICT,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
  INDEX idx_purchases_date (purchase_date)
);

CREATE TABLE IF NOT EXISTS fixed_expenses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  monthly_amount DECIMAL(12,2) NOT NULL
);

-- Clave/valor: margin_percent, monthly_units (para prorratear gastos fijos)
CREATE TABLE IF NOT EXISTS settings (
  name VARCHAR(50) PRIMARY KEY,
  value VARCHAR(100) NOT NULL
);

INSERT IGNORE INTO settings (name, value) VALUES ('margin_percent', '100'), ('monthly_units', '200');
