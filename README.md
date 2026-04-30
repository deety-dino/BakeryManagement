# 🍰 BakeManage - Ứng dụng Quản lý Tiệm Bánh

Một ứng dụng web đơn trang (Single Page Application) để quản lý hoạt động tiệm bánh, bao gồm quản lý chi nhánh, nguyên liệu, công thức, sản xuất và lợi nhuận.

## Tính năng

### 1. **Quản lý Tài khoản**
- Đăng nhập với vai trò Quản trị viên (Master)
- Đăng nhập với vai trò Chi nhánh (Admin/Staff)
- Xác thực an toàn với mật khẩu

### 2. **Quản lý Chi nhánh** (Quản trị viên)
- Thêm, chỉnh sửa, xóa chi nhánh
- Quản lý mật khẩu Admin và Staff
- Hiển thị thông tin chi nhánh

### 3. **Quản lý Nguyên liệu**
- Thêm, chỉnh sửa, xóa nguyên liệu
- Phân loại theo danh mục (Bột, Đường, Trứng, v.v.)
- Theo dõi đơn vị tính

### 4. **Quản lý Công thức**
- Tạo công thức bánh mới
- Quản lý danh sách nguyên liệu cho mỗi công thức
- Lọc công thức theo danh mục
- Chỉnh sửa và xóa công thức

### 5. **Sản xuất & Tối ưu hóa**
- Theo dõi sản xuất hàng ngày
- Tính toán lợi nhuận

## Cấu trúc Dự án

```
├── index.html              # Trang chính (entry point)
├── css/
│   ├── base.css           # CSS cơ bản
│   ├── login-screen.css   # CSS cho màn hình đăng nhập
│   ├── main-app.css       # CSS cho ứng dụng chính
│   └── shop-management.css # CSS cho quản lý chi nhánh
├── js/
│   ├── api.js             # API wrapper (backend + offline mode)
│   ├── auth.js            # Logic xác thực
│   ├── data-mock.js       # Mock data cho offline mode
│   ├── shop-management.js # Logic quản lý chi nhánh
│   └── ui.js              # Helper UI
└── server/                # (Optional) Backend server files
```

## Cách Sử Dụng

### Chế độ Development (Localhost)
1. Clone repository
2. Mở `index.html` bằng trình duyệt
3. Sử dụng thông tin đăng nhập demo

### Chế độ GitHub Pages (Production)
1. Push repo lên GitHub
2. Vào **Settings > Pages**
3. Chọn **Deploy from a branch**
4. Chọn nhánh và thư mục (thường là `main` và root `/`)
5. GitHub sẽ tự động deploy tại `https://username.github.io/repo-name`
6. Nếu muốn kết nối tới backend/MySQL thật, mở [js/app-config.js](js/app-config.js) và đặt `window.BAKEMANAGE_API_BASE_URL` về URL backend đã deploy của bạn

## Thông Tin Đăng Nhập Demo

### Quản trị viên (Master)
- **Master ID**: `demo-master`
- **Password**: `123456`

### Chi nhánh
- **Master ID**: `demo-master`
- **Shop ID**: `shop-001`
- **Admin Password**: `admin123`
- **Staff Password**: `staff123`

## Công nghệ Sử dụng

- **Frontend**: HTML5, CSS3, Vanilla JavaScript (ES6+)
- **Storage**: LocalStorage (cho session + mock data)
- **Tương thích**: Chrome, Firefox, Edge, Safari (hiện đại)

## Đặc điểm Offline

Ứng dụng hỗ trợ hoạt động **hoàn toàn offline**:
- Tất cả dữ liệu được lưu trong `localStorage`
- Mock API thay thế backend server
- Dữ liệu tồn tại giữa các phiên làm việc

## API Endpoints (Mô phỏng)

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| POST | `/api/auth/master-login` | Đăng nhập Master |
| POST | `/api/auth/shop-login` | Đăng nhập Chi nhánh |
| GET | `/api/shops` | Lấy danh sách chi nhánh |
| POST | `/api/shops` | Tạo chi nhánh mới |
| PUT | `/api/shops/:id` | Cập nhật chi nhánh |
| DELETE | `/api/shops/:id` | Xóa chi nhánh |
| GET | `/api/ingredients` | Lấy danh sách nguyên liệu |
| POST | `/api/ingredients` | Tạo nguyên liệu mới |
| GET | `/api/recipes` | Lấy danh sách công thức |
| POST | `/api/recipes` | Tạo công thức mới |

## Hướng Phát Triển

- [ ] Backend API thực (Node.js + MySQL)
- [ ] Phân quyền chi tiết hơn
- [ ] Import/Export dữ liệu (CSV, Excel)
- [ ] Thống kê nâng cao
- [ ] Thông báo real-time
- [ ] Mobile app

## Liên Hệ & Hỗ Trợ

Nếu có vấn đề, vui lòng tạo Issue trong repository.

## Giấy Phép

MIT License - Tự do sử dụng và sửa đổi
