-- Stock de insumos (en la unidad del insumo) y de productos terminados por aroma

ALTER TABLE supplies ADD COLUMN stock DECIMAL(12,3) NOT NULL DEFAULT 0 AFTER package_price;

-- scent_id = 0 significa "sin aroma" (así la clave única funciona; NULL no se compara en UNIQUE)
CREATE TABLE IF NOT EXISTS product_stock (
  product_id INT NOT NULL,
  scent_id INT NOT NULL DEFAULT 0,
  quantity INT NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, scent_id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- Cada vez que se fabrica: qué se hizo y cuánto insumo se consumió (para poder deshacerlo)
CREATE TABLE IF NOT EXISTS productions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  scent_id INT NOT NULL DEFAULT 0,
  quantity INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS production_items (
  production_id INT NOT NULL,
  supply_id INT NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  PRIMARY KEY (production_id, supply_id),
  FOREIGN KEY (production_id) REFERENCES productions(id) ON DELETE CASCADE,
  FOREIGN KEY (supply_id) REFERENCES supplies(id) ON DELETE RESTRICT
);
