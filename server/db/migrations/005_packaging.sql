-- Packaging como apartado propio: cada artículo (caja, bolsa, moño, etiqueta...) tiene su costo,
-- y cada producto lleva los artículos y cantidades que usa. Reemplaza el monto fijo products.packaging_cost.
CREATE TABLE IF NOT EXISTS packaging (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  package_qty DECIMAL(12,3) NOT NULL DEFAULT 1,
  package_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (package_qty > 0),
  CHECK (package_price >= 0)
);

CREATE TABLE IF NOT EXISTS product_packaging (
  product_id INT NOT NULL,
  packaging_id INT NOT NULL,
  quantity DECIMAL(12,3) NOT NULL,
  PRIMARY KEY (product_id, packaging_id),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (packaging_id) REFERENCES packaging(id) ON DELETE RESTRICT,
  CHECK (quantity > 0)
);

-- Los montos de packaging que ya estaban cargados no se pierden: cada uno pasa a ser un artículo
-- "Packaging de <producto>" asignado a ese producto. Después se pueden renombrar o reemplazar.
INSERT INTO packaging (name, package_qty, package_price)
SELECT CONCAT('Packaging de ', name), 1, packaging_cost FROM products WHERE packaging_cost > 0;

INSERT INTO product_packaging (product_id, packaging_id, quantity)
SELECT p.id, pk.id, 1
FROM products p JOIN packaging pk ON pk.name = CONCAT('Packaging de ', p.name)
WHERE p.packaging_cost > 0;

ALTER TABLE products DROP COLUMN packaging_cost;
