DROP DATABASE railway;
CREATE DATABASE railway;
USE railway;
CREATE TABLE IF NOT EXISTS master (
    master_uid VARCHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
    master_id VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    master_name VARCHAR(255) NOT NULL
);
CREATE TABLE IF NOT EXISTS shop (
    shop_uid VARCHAR(36) NOT NULL PRIMARY KEY DEFAULT (UUID()),
    shop_id VARCHAR(36) NOT NULL DEFAULT ("main"),
    master_id VARCHAR(36) NOT NULL,
    shop_name VARCHAR(50) NOT NULL,
    administrator_password VARCHAR(255) NOT NULL,
    staff_password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_shop_shop_id (shop_id),
    UNIQUE KEY uq_shop_master_name (master_id, shop_name),
    CONSTRAINT fk_shop_master FOREIGN KEY (master_id) REFERENCES master(master_uid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ingredients (
    id INT NOT NULL PRIMARY KEY,
    master_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(255),
    unit VARCHAR(50) NOT NULL,
    UNIQUE KEY uq_ingredients_master_name (master_id, name),
    CONSTRAINT fk_ingredients_master FOREIGN KEY (master_id) REFERENCES master(master_uid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS products (
    id INT NOT NULL PRIMARY KEY,
    master_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    base_price DECIMAL(10, 2) DEFAULT 0,
    UNIQUE KEY uq_products_master_name (master_id, name),
    CONSTRAINT fk_products_master FOREIGN KEY (master_id) REFERENCES master(master_uid) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS recipes (
    master_id VARCHAR(36) NOT NULL,
    product_id INT NOT NULL,
    ingredient_id INT NOT NULL,
    quantity_needed DECIMAL(10, 4) NOT NULL,
    PRIMARY KEY (product_id, ingredient_id),
    CONSTRAINT fk_recipe_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    CONSTRAINT fk_recipe_ingredient FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE,
    CONSTRAINT fk_recipe_master FOREIGN KEY (master_id) REFERENCES master(master_uid) ON DELETE CASCADE
);