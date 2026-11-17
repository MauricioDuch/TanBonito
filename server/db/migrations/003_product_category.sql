-- Tipo de producto: velas y aromas se listan por separado en Productos y Recetas.
-- Lo que ya existe queda como vela; se puede cambiar editando el producto.
ALTER TABLE products
  ADD COLUMN category ENUM('vela', 'aroma') NOT NULL DEFAULT 'vela' AFTER name;
