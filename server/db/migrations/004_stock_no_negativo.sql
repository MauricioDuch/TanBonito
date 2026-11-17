-- El stock nunca puede ser negativo. Lo que había quedado en negativo se lleva a 0
-- y la base rechaza cualquier valor menor a 0 de ahora en más.
UPDATE product_stock SET quantity = 0 WHERE quantity < 0;
UPDATE supplies SET stock = 0 WHERE stock < 0;

ALTER TABLE product_stock ADD CONSTRAINT chk_product_stock_no_negativo CHECK (quantity >= 0);
ALTER TABLE supplies ADD CONSTRAINT chk_supplies_stock_no_negativo CHECK (stock >= 0);
