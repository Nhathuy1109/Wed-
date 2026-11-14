# Các mục đã bổ sung, chỉnh sửa

1. **Lưu kết quả làm đề** — bảng `quiz_results`; `saveQuizResult`; xếp hạng theo tổng điểm cao nhất (%) của từng đề; hiện kỷ lục trên từng đề và thẻ kết quả sau khi làm.
2. **Tìm kiếm tốt hơn** — không phân biệt dấu, lọc theo môn / mục / loại file, nhớ 6 từ khóa gần đây.
3. **Sắp xếp và yêu thích** — bảng `favorites`; ngôi sao ở tài liệu và đề; mục “Đã lưu” ở tab Tôi; sắp xếp 5 kiểu trong từng môn.
5. **Đổi tên, chuyển tài liệu** — nút Sửa cho chủ web (`updateDocument`), cập nhật cả lịch sử thống kê.
6. **Thông báo thành viên** — chấm báo ở tab Môn, số “mới” theo môn, nhãn “Mới” cho file; tự tải lại khi quay lại ứng dụng.
10. **Biệt danh trong bình luận** — cột `profiles.nickname`; chủ web thấy tên thật, người khác chỉ thấy biệt danh (che ở server).
12. **Vuốt để quay lại, giữ vị trí cuộn** — vuốt phải từ nửa trái màn hình; mỗi tab nhớ màn và vị trí cuộn.

## File thay đổi
- migrations/0006_results_favorites_nickname.sql (mới)
- src/lib/library/ids.ts, src/lib/library/api.ts
- src/components/library/library-app.tsx, leaderboard.tsx, ui.tsx
- README.md, CHANGELOG.md
