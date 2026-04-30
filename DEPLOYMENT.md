# BakeManage - Hướng Dẫn Deployment trên GitHub Pages

## 1. Chuẩn Bị

### Yêu cầu
- Tài khoản GitHub
- Git đã cài đặt trên máy
- Một repository trên GitHub

### Bước Chuẩn Bị
1. Clone repository về máy:
   ```bash
   git clone <URL-của-repo-bạn>
   cd Solution1
   ```

2. Thêm tất cả file vào git:
   ```bash
   git add .
   git commit -m "Initial commit for GitHub Pages deployment"
   ```

## 2. Cấu Hình GitHub Pages

### Cách 1: Tự Động Deploy (Khuyến Nghị)

1. **Push code lên GitHub:**
   ```bash
   git push origin main
   ```

2. **Vào Settings của Repository:**
   - Truy cập `Settings` > `Pages`
   - Dưới "Build and deployment"
   - Chọn "Deploy from a branch"
   - Chọn nhánh `main` và thư mục `/ (root)`
   - Click "Save"

3. **GitHub Actions sẽ tự động chạy:**
   - File `.github/workflows/deploy.yml` sẽ kích hoạt tự động
   - Chờ workflow hoàn tất (xem tab "Actions" để theo dõi)

### Cách 2: Deploy Thủ Công

Nếu không muốn sử dụng GitHub Actions:

1. Vào `Settings` > `Pages`
2. Chọn "Deploy from a branch"
3. Chọn `main` branch và `/` (root) folder
4. Click "Save"

## 3. Xác Minh Deployment

1. Chờ vài phút để GitHub xử lý
2. Trở lại `Settings` > `Pages`
3. Bạn sẽ thấy URL như: `https://username.github.io/Solution1`
4. Truy cập URL này để kiểm tra ứng dụng

## 4. Cập Nhật Ứng Dụng

Mỗi lần bạn muốn cập nhật:

```bash
# Thay đổi file
# ...

# Commit và push
git add .
git commit -m "Update: mô tả thay đổi"
git push origin main
```

GitHub Pages sẽ tự động cập nhật trong vài phút.

## 5. Các Vấn Đề Thường Gặp

### ❌ Trang không hiển thị đúng
- Kiểm tra Console (F12) xem có lỗi JavaScript không
- Đảm bảo tất cả paths đều tương đối (không dùng paths tuyệt đối)
- Clear browser cache (Ctrl+Shift+Delete)

### ❌ CSS/JS không tải
- Kiểm tra Network tab trong DevTools
- Đảm bảo file path trong HTML chính xác
- Ví dụ: `<link rel="stylesheet" href="css/base.css">`

### ❌ Lỗi CORS
- GitHub Pages không hỗ trợ cross-origin requests
- Tất cả API phải mock data (đã xử lý trong `js/data-mock.js`)

### ❌ Dữ liệu không lưu
- Dữ liệu được lưu trong `localStorage`
- Mỗi tên miền GitHub Pages khác nhau sẽ có storage riêng
- Xóa dữ liệu: Mở DevTools > Application > Local Storage > Delete

## 6. Cấu Hình Tên Miền Custom (Optional)

Nếu muốn sử dụng tên miền riêng:

1. Vào `Settings` > `Pages`
2. Dưới "Custom domain", nhập tên miền của bạn
3. Làm theo hướng dẫn để cấu hình DNS

## 7. Khiên Bảo Mật

### ⚠️ Lưu Ý Quan Trọng:
- **Không commit password thực vào repository**
- Sử dụng mock data cho demo (xem `js/data-mock.js`)
- Tất cả dữ liệu được lưu trong `localStorage` của browser
- Trong production, cần backend server an toàn

### Demo Credentials (Chỉ cho test):
- Master ID: `demo-master`
- Password: `123456`

## 8. Hiệu Năng

### Tối ưu hóa:
- Tất cả tệp được cache bởi GitHub
- CDN tự động (GitHub Pages sử dụng GitHub's CDN)
- Không cần lo tối ưu hóa HTTP requests

### Giới hạn:
- Kích thước repo < 1 GB
- Bandwidth không giới hạn
- 100 GitHub Pages deployments mỗi giờ

## 9. Workflow Tiêu Chuẩn

```
1. Viết code locally
   ↓
2. Commit & Push
   git add .
   git commit -m "message"
   git push origin main
   ↓
3. GitHub Actions chạy (nếu có)
   ↓
4. Deploy hoàn tất (xem URL)
   ↓
5. Truy cập https://username.github.io/Solution1
```

## 10. Kiểm Tra & Debug

### Xem logs:
- Vào tab `Actions` trong repository
- Click workflow run mới nhất
- Xem "Deploy to GitHub Pages" job

### Debug trong browser:
```javascript
// Mở DevTools (F12) > Console

// Kiểm tra session
localStorage.getItem('bakemanage.authSession')

// Kiểm tra mock data
JSON.parse(localStorage.getItem('bakemanage.mockData'))

// Kiểm tra API
window.dbApi
```

## Liên Hệ Hỗ Trợ

Nếu gặp vấn đề:
1. Kiểm tra console browser (F12)
2. Xem GitHub Actions logs
3. Tạo Issue trong repository

---

**Chúc bạn deploy thành công! 🚀**
