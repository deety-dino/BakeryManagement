USE railway;
-- 0. Bảng cửa hàng
CREATE TABLE IF NOT EXISTS master(
    master_uid VARCHAR(20) NOT NULL PRIMARY KEY DEFAULT (UUID()),
    master_id VARCHAR(50) NOT NULL UNIQUE ,
    password_hash  VARCHAR(255) NOT NULL,
    master_name  VARCHAR(255) NOT NULL
);

-- 1. Bảng Người dùng (Cửa hàng)
CREATE TABLE IF NOT EXISTS shop (
    shop_id VARCHAR(10) NOT NULL PRIMARY KEY DEFAULT (UUID()),
    master_id VARCHAR(20) NOT NULL ,
    shop_name VARCHAR(50) NOT NULL UNIQUE,
    administrator_password VARCHAR(255) NOT NULL,
    staff_password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT FOREIGN KEY fk_shop_master(master_id) REFERENCES master(master_uid) ON DELETE CASCADE
);

-- 2. Bảng Nguyên liệu
CREATE TABLE IF NOT EXISTS ingredients (
    id INT(3) DEFAULT (UUID()),
    master_id VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(255),
    unit VARCHAR(5) NOT NULL, -- Ví dụ: kg, gram, lít
    PRIMARY KEY (master_id, id),
    CONSTRAINT FOREIGN KEY fk_ingredients_master(master_id)  REFERENCES master(master_uid) ON DELETE CASCADE
);
-- 3. Bảng Món bánh (Thành phẩm)
CREATE TABLE IF NOT EXISTS products (
    id INT(3) DEFAULT(UUID()) UNIQUE ,
    master_id VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    base_price DECIMAL(10, 0),
    FOREIGN KEY kf_products_master(master_id) REFERENCES master(master_uid) ON DELETE CASCADE,
    PRIMARY KEY (master_id, id)
);

-- 4. Bảng Công thức (Recipes)
CREATE TABLE IF NOT EXISTS recipes (
    master_id VARCHAR(20),
    product_id INT NOT NULL,
    ingredient_id INT NOT NULL,
    quantity_needed DECIMAL(10) NOT NULL, -- Lượng nguyên liệu cho 1 đơn vị bánh
    PRIMARY KEY (product_id, ingredient_id),
    CONSTRAINT FOREIGN KEY fk_recipe_product(product_id) REFERENCES products(id) ON DELETE CASCADE,
    CONSTRAINT FOREIGN KEY fk_recipe_ingredient(ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE,
    CONSTRAINT FOREIGN KEY fk_recipe_master(master_id) REFERENCES master(master_uid) ON DELETE CASCADE
);