# Cấu hình Mochi AI

Mochi AI gọi dịch vụ AI từ máy chủ, không để lộ API key trong trình duyệt. Để bật trả lời thật, hãy cấu hình các biến môi trường sau ở môi trường deploy/server:

- `OPENAI_API_KEY`: API key của nhà cung cấp AI tương thích OpenAI Chat Completions.
- `OPENAI_MODEL`: tên model mà tài khoản API của bạn được phép sử dụng.
- `OPENAI_BASE_URL` (không bắt buộc): endpoint Chat Completions. Mặc định là `https://api.openai.com/v1/chat/completions`.

Ví dụ cấu hình trên máy chủ (không commit khóa thật vào Git):

```env
OPENAI_API_KEY=your-secret-api-key
OPENAI_MODEL=your-available-model
# OPENAI_BASE_URL=https://api.openai.com/v1/chat/completions
```

Sau khi thêm biến môi trường, khởi động lại hoặc redeploy ứng dụng. Nếu chưa cấu hình, trang Mochi AI vẫn hiển thị nhưng sẽ báo rõ rằng dịch vụ chưa sẵn sàng. Không đặt các khóa này dưới tên biến `VITE_*` vì biến `VITE_*` có thể được đưa vào mã trình duyệt.

Mochi AI có thể đọc văn bản trích xuất từ PDF có lớp text, DOCX, TXT, Markdown và HTML trong thư viện. PDF scan ảnh chưa được OCR. Văn bản được gửi đến nhà cung cấp AI đã cấu hình để trả lời câu hỏi.
