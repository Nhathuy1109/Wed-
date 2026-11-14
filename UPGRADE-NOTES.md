# Mochi Library — Pixel Fantasy Upgrade

Bản nâng cấp này giữ lại cấu trúc ứng dụng và các chức năng thư viện hiện có, đồng thời bổ sung các mục đã chọn:

1. **Thế giới pixel ở trang chủ:** cảnh fantasy nhiều lớp, linh thú đồng hành và trạng thái vùng đất.
2. **Chu kỳ thời gian:** bình minh, ban ngày, hoàng hôn và ban đêm; có chế độ tự động hoặc chọn thủ công.
3. **Vật phẩm trang trí:** pha lê, đèn lồng, nấm thần, lửa trại và đài nước.
4. **Cá nhân hóa:** bảng màu Đồng cỏ, Đại dương, Hoàng hôn; lựa chọn môi trường và bật/tắt hoạt ảnh.
5. **Tương tác:** chạm chăm sóc linh thú, thông báo phản hồi và bộ đếm được lưu trong trình duyệt.
6. **Điều hướng:** tinh chỉnh trạng thái tab đang chọn, hiệu ứng nhấn và nền mờ.
7. **Màn hình tải:** màn mở cổng pixel riêng thay cho khung tải mặc định ở lần tải thư viện.
8. **Bộ sưu tập linh thú:** bổ sung T-Rex, Stegosaurus và Rồng phương Tây; tổng cộng 34 lựa chọn.
9. **Hồ sơ linh thú:** mỗi loài có tính cách, nguyên tố, môi trường yêu thích và độ hiếm.
10. **Khu vườn tương tác:** chọn linh thú, xem hồ sơ, chăm sóc và xem số lần tương tác.
11. **Môi trường sống:** Rừng cổ tích, Núi tuyết, Thung lũng lửa, Bờ biển mây và Quần đảo trên mây.

## Lưu trữ và quyền riêng tư

Tùy chọn thế giới, linh thú đang chọn và số lần tương tác được lưu bằng `localStorage` trên trình duyệt hiện tại. Chúng không tự đồng bộ giữa các thiết bị hoặc trình duyệt khác.

## Chạy dự án

Dự án dùng các script đã có trong `package.json`:

- `npm install`
- `npm run dev`
- `npm run typecheck`
- `npm run build`

Các chức năng thư viện, tài khoản và dữ liệu máy chủ cũ vẫn sử dụng cấu hình triển khai ban đầu của dự án.
