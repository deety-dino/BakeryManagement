
USE railway;

-- Bảng quản lý tồn kho NGUYÊN LIỆU hiện tại
CREATE TABLE ingredient_stock (
                                  ingredient_id INT PRIMARY KEY,
                                  quantity DECIMAL(10, 4) NOT NULL DEFAULT 0 COMMENT 'Số lượng nguyên liệu còn lại',
                                  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                                  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
);

-- Bảng quản lý tồn kho BÁNH (THÀNH PHẨM) hiện tại
CREATE TABLE product_stock (
                               product_id INT PRIMARY KEY,
                               quantity INT NOT NULL DEFAULT 0 COMMENT 'Số lượng bánh tồn lại',
                               last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                               FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);
CREATE TABLE ingredients (
                             id INT AUTO_INCREMENT PRIMARY KEY,
                             name VARCHAR(255) NOT NULL,
                             category VARCHAR(100),
                             unit VARCHAR(50) NOT NULL COMMENT 'Đơn vị tính (kg, gram, lít, quả...)'
);

-- 2. Bảng Lịch sử nhập nguyên liệu (Ingredient Imports)
CREATE TABLE ingredient_imports (
                                    id INT AUTO_INCREMENT PRIMARY KEY,
                                    ingredient_id INT NOT NULL,
                                    import_date DATE NOT NULL,
                                    quantity DECIMAL(10, 2) NOT NULL COMMENT 'Số lượng nhập',
                                    unit_price DECIMAL(15, 2) NOT NULL COMMENT 'Giá nhập trên 1 đơn vị',
                                    FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
);

-- 3. Bảng Sản phẩm / Món bánh (Products)
CREATE TABLE products (
                          id INT AUTO_INCREMENT PRIMARY KEY,
                          name VARCHAR(255) NOT NULL,
                          description TEXT COMMENT 'Mô tả cách làm / Hướng dẫn',
                          selling_price DECIMAL(15, 2) NOT NULL COMMENT 'Giá bán dự kiến'
);

-- 4. Bảng Công thức làm bánh (Recipes)
-- Đóng vai trò là bảng trung gian kết nối Products và Ingredients (Quan hệ n-n)
CREATE TABLE recipes (
                         product_id INT NOT NULL,
                         ingredient_id INT NOT NULL,
                         quantity_needed DECIMAL(10, 4) NOT NULL COMMENT 'Định lượng nguyên liệu cần cho 1 đơn vị bánh',
                         PRIMARY KEY (product_id, ingredient_id),
                         FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
                         FOREIGN KEY (ingredient_id) REFERENCES ingredients(id) ON DELETE CASCADE
);

-- 5. Bảng Lịch sử sản xuất (Daily Production)
CREATE TABLE daily_productions (
                                   id INT AUTO_INCREMENT PRIMARY KEY,
                                   product_id INT NOT NULL,
                                   production_date DATE NOT NULL,
                                   quantity_produced INT NOT NULL COMMENT 'Số lượng bánh làm ra',
                                   FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- 6. Bảng Lịch sử bán hàng (Daily Sales)
-- Tách biệt với bảng sản xuất vì số lượng làm ra có thể không bằng số lượng bán được
CREATE TABLE daily_sales (
                             id INT AUTO_INCREMENT PRIMARY KEY,
                             product_id INT NOT NULL,
                             sale_date DATE NOT NULL,
                             quantity_sold INT NOT NULL,
                             actual_selling_price DECIMAL(15, 2) NOT NULL COMMENT 'Giá bán thực tế (có thể thay đổi do khuyến mãi)',
                             FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

-- 7. Bảng Chi phí cố định/Khác (Fixed Costs)
CREATE TABLE fixed_costs (
                             id INT AUTO_INCREMENT PRIMARY KEY,
                             expense_name VARCHAR(255) NOT NULL COMMENT 'Tên chi phí (Mặt bằng, Điện, Nước...)',
                             expense_date DATE NOT NULL COMMENT 'Ngày ghi nhận chi phí',
                             amount DECIMAL(15, 2) NOT NULL
);