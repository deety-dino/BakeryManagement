USE railway;
ALTER TABLE daily_sales MODIFY COLUMN id INT(5);
CREATE TABLE ingredient_imports (
    id INT(5) PRIMARY KEY,
    shop_id VARCHAR(10) NOT NULL,
    ingredient_id INT NOT NULL,
    quantity DECIMAL(10) NOT NULL,
    import_price DECIMAL(10, 3) NOT NULL,
    import_date DATE DEFAULT (CURRENT_DATE),
    CONSTRAINT FOREIGN KEY fk_import_shop(shop_id) REFERENCES shop(shop_id) ON DELETE CASCADE ,
    CONSTRAINT FOREIGN KEY fk_import_ingredient(ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
);

-- 6. Bảng Sản xuất bánh
CREATE TABLE daily_productions (
    id INT(5),
    shop_id VARCHAR(10) NOT NULL,
    product_id INT NOT NULL,
    quantity_produced INT NOT NULL,
    production_date DATE DEFAULT (CURRENT_DATE),
    PRIMARY KEY (shop_id, id),
    CONSTRAINT FOREIGN KEY fk_daily_production_shop(shop_id) REFERENCES shop(shop_id) ON DELETE CASCADE ,
    CONSTRAINT FOREIGN KEY fk_product_id(product_id) REFERENCES products(id)
);

-- 7. Bảng Bán hàng
CREATE TABLE daily_sales (
    id INT(5) PRIMARY KEY,
    shop_id VARCHAR(10) NOT NULL,
    product_id INT NOT NULL,
    quantity_sold INT NOT NULL,
    actual_sale_price DECIMAL(10, 2) NOT NULL,
    sale_date DATE DEFAULT (CURRENT_DATE),
    FOREIGN KEY fk_sales_shop(shop_id) REFERENCES shop(shop_id) ON DELETE CASCADE ,
    FOREIGN KEY fk_sales_id(product_id) REFERENCES products(id)
);

-- 8. Bảng Chi phí vận hành
CREATE TABLE fixed_costs (
    id INT(4) PRIMARY KEY DEFAULT(UUID_SHORT()),
    shop_id VARCHAR(20) NOT NULL,
    cost_name VARCHAR(255) NOT NULL,
    amount DECIMAL(15, 2) NOT NULL,
    cost_date DATE DEFAULT (CURRENT_DATE),
    FOREIGN KEY fk_shop_fixed_cost(shop_id) REFERENCES shop(shop_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ingredient_stock (
    shop_id VARCHAR(10) NOT NULL,
    ingredient_id INT(3) NOT NULL,
    quantity DECIMAL(10,1) DEFAULT 0,
    PRIMARY KEY (shop_id, ingredient_id),
    FOREIGN KEY fk_shop_ingredients_stock(shop_id) REFERENCES shop(shop_id) ON DELETE CASCADE ,
    FOREIGN KEY fk_ingredients_stock(ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
);

-- 10. Tồn kho Bánh
CREATE TABLE product_stock (
    shop_id VARCHAR(10) NOT NULL,
    product_id INT(3) NOT NULL,
    quantity INT DEFAULT 0,
    PRIMARY KEY (shop_id, product_id),
    FOREIGN KEY fk_shop_products_stock(shop_id) REFERENCES shop(shop_id) ON DELETE CASCADE ,
    FOREIGN KEY fk_products_stock(product_id) REFERENCES products(id) ON DELETE CASCADE
);