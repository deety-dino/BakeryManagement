USE railway;

DROP TRIGGER IF EXISTS before_insert_daily_productions;
DROP TRIGGER IF EXISTS before_insert_daily_sales;
DROP TRIGGER IF EXISTS trg_ingredients_ai_create_shop_stock;
DROP TRIGGER IF EXISTS trg_after_import;
DROP TRIGGER IF EXISTS trg_after_production;
DROP TRIGGER IF EXISTS trg_after_sales;

DELIMITER //

CREATE TRIGGER before_insert_daily_productions
    BEFORE INSERT ON daily_productions
    FOR EACH ROW
BEGIN
    SET NEW.id = (
        SELECT IFNULL(MAX(id), 0) + 1
        FROM daily_productions
        WHERE shop_id = NEW.shop_id
    );
END//

CREATE TRIGGER before_insert_daily_sales
    BEFORE INSERT ON daily_sales
    FOR EACH ROW
BEGIN
    SET NEW.id = (
        SELECT IFNULL(MAX(id), 0) + 1
        FROM daily_sales
    );
END//

CREATE TRIGGER trg_ingredients_ai_create_shop_stock
    AFTER INSERT ON ingredients
    FOR EACH ROW
BEGIN
    INSERT INTO ingredient_stock (shop_id, ingredient_id, quantity)
    SELECT s.shop_uid, NEW.id, 0
    FROM shop s
    WHERE s.master_id = NEW.master_id
    ON DUPLICATE KEY UPDATE quantity = quantity;
END//

CREATE TRIGGER trg_after_import
    AFTER INSERT ON ingredient_imports
    FOR EACH ROW
BEGIN
    INSERT INTO ingredient_stock (shop_id, ingredient_id, quantity)
    VALUES (NEW.shop_id, NEW.ingredient_id, NEW.quantity)
    ON DUPLICATE KEY UPDATE quantity = quantity + NEW.quantity;
END//

CREATE TRIGGER trg_after_production
    AFTER INSERT ON daily_productions
    FOR EACH ROW
BEGIN
    UPDATE ingredient_stock s
    JOIN recipes r ON s.ingredient_id = r.ingredient_id
    SET s.quantity = s.quantity - (r.quantity_needed * NEW.quantity_produced)
    WHERE r.product_id = NEW.product_id
      AND s.shop_id = NEW.shop_id;

    INSERT INTO product_stock (shop_id, product_id, quantity)
    VALUES (NEW.shop_id, NEW.product_id, NEW.quantity_produced)
    ON DUPLICATE KEY UPDATE quantity = quantity + NEW.quantity_produced;
END//

CREATE TRIGGER trg_after_sales
    AFTER INSERT ON daily_sales
    FOR EACH ROW
BEGIN
    UPDATE product_stock
    SET quantity = quantity - NEW.quantity_sold
    WHERE product_id = NEW.product_id
      AND shop_id = NEW.shop_id;
END//

DELIMITER ;
