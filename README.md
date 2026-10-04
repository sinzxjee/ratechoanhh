# ratechotui

Website phản hồi và trang quản lý, có thể cài lên màn hình chính dưới dạng PWA.

## Triển khai bản sửa

**Cần cập nhật cả backend và frontend. Giao diện mới không dùng được với bản Apps Script cũ.**

### 1. Cập nhật Apps Script

1. Mở file Google Sheet đang dùng: https://docs.google.com/spreadsheets/d/19VMyZMlWPwnt69FDE1ujU1YzBoycpeHreWCEl3qAuz0/edit#gid=1838045048.
2. Vào Extensions / Tiện ích → Apps Script. Sao lưu mã cũ trước khi thay.
3. Thay nội dung `Code.gs` bằng `apps-script/Code.gs` trong repo này. Thêm một file **HTML** tên `Bridge` và dán nội dung `apps-script/Bridge.html`.
4. Project Settings → Script Properties:
   - `ADMIN_KEY`: đặt mật khẩu admin của bạn ở đây, không đưa mật khẩu vào mã repo hay URL.
   - `ALLOWED_ORIGINS`: `https://sinzxjee.github.io` nếu dùng GitHub Pages mặc định. Nếu app chạy ở tên miền khác, dùng đúng origin của app (ví dụ `https://example.com`, không kèm đường dẫn hoặc dấu `/` cuối). Có thể phân tách nhiều origin bằng dấu phẩy. Khi test local, chỉ thêm origin localhost đang dùng rồi bỏ đi khi test xong.
5. Trong editor, chọn hàm `setupBackend` rồi Run. Tài khoản sở hữu backend phải cấp các quyền Google Sheets, Drive và gửi email. Hàm này chuẩn bị tiêu đề cột và đọc hạn mức email, **không gửi thư thử**.
6. Deploy → Manage deployments → Edit bản **Web app** đang dùng → chọn **New version** → Deploy. Execute as: **Me**; Who has access: **Anyone**. Nếu Google yêu cầu cấp thêm quyền, chủ tài khoản cần tự hoàn thành bước đó.
7. Nếu cập nhật deployment cũ thì URL `/exec` được giữ nguyên. Nếu tạo deployment mới, thay `SCRIPT_URL` ở `backend-client.js` bằng URL `/exec` mới.

Backend dùng `SpreadsheetApp.openById` để mở đúng file trên và lưu vào tab **Feedback**. `gid=1946808283` trong link ban đầu là tab **Trang tính2**, không phải tab Feedback. Không đổi hay ghi đè dữ liệu tab Trang tính2.

Tab Feedback giữ 8 cột cũ A:H. Bản sửa thêm I=`RequestID`, J=`ReplyRequestID` để chống gửi trùng khi người dùng thử lại. Nếu A:H hoặc I:J khác cấu trúc này, backend sẽ báo lỗi thay vì ghi đè dữ liệu hiện có. Nếu chưa có tab Feedback, backend tạo tab này.

Ảnh đính kèm lưu riêng tư trong Drive của chủ backend. Admin mở link ảnh bằng tài khoản Google sở hữu file; ảnh không tự được công khai.

### 2. Cập nhật website

Đưa các file frontend trong repo lên hosting đang dùng. Khi deploy từ GitHub Pages, cấu hình Pages trỏ vào thư mục gốc của nhánh chứa bản sửa. Folder `apps-script` là mã để copy vào Google Apps Script, không chạy backend qua GitHub Pages. Không đưa mật khẩu, file clasp hay khóa Google lên GitHub.

Mặc định origin cho Apps Script là `https://sinzxjee.github.io`. Nếu website dùng origin khác, cập nhật `ALLOWED_ORIGINS` tương ứng; không cần đổi origin trong frontend vì frontend tự gửi `location.origin` khi kết nối.

Frontend dùng iframe HTML Service của Google và `google.script.run` để nhận kết quả thành công/lỗi mà không phụ thuộc vào CORS của ContentService. Kết nối kiểm tra origin, mã kênh ngẫu nhiên và cửa sổ phản hồi. Mật khẩu và dữ liệu phản hồi truyền bằng `postMessage` tới đúng iframe, không được đặt trong URL.

### 3. Kiểm tra trên môi trường thật

1. Tải lại trang khi có mạng. Gửi một feedback thử do bạn tự nhập; kiểm tra dòng mới ở tab Feedback trước khi xác nhận hoàn tất.
2. Bấm **Quản lý phản hồi**, đăng nhập bằng ADMIN_KEY đã đặt và kiểm tra form trả lời của dòng vừa tạo.
3. Gửi trả lời đến email thử do bạn sở hữu. Kiểm tra hộp thư, Spam và trạng thái `Yes` trong cột G. Backend chỉ xác nhận Google đã nhận lệnh gửi; không thể đảm bảo thư tới Inbox thay vì Spam.
4. Bấm **Cài app** trên Chrome/Edge. Trên iPhone, dùng Safari → Chia sẻ → Thêm vào Màn hình chính. Đây là cài PWA, không phải file APK.
5. Mở app sau khi đã tải trang online rồi bật chế độ offline: form và tải thiệp vẫn hoạt động. Gửi feedback/admin cần có mạng; nội dung được giữ lại khi gửi thất bại.

Nếu Google báo hết hạn mức email, đợi hạn mức được khôi phục. Nếu báo thiếu quyền, chạy lại `setupBackend` bằng tài khoản deploy rồi cập nhật bản deployment. Nếu cột G là `Sending`, kiểm tra thư đã gửi và trạng thái Sheet trước khi gửi tiếp; trạng thái này cố ý ngăn tự gửi trùng khi kết quả gửi chưa chắc chắn.

## Chạy test

Yêu cầu Node.js 20 trở lên:

```sh
npm install
npx playwright install chromium
npm test
```

Hoặc đặt `CHROME_PATH` thành đường dẫn Chrome có sẵn rồi chạy `npm test`. `TEST_OUTPUT_DIR` chọn thư mục lưu kết quả và ảnh test; mặc định là `test-results/`.

Test backend dùng mock Google APIs; test trình duyệt dùng HTML bridge với `google.script.run` giả lập. Test không ghi vào Sheet thật, tải ảnh lên Drive thật hay gửi email thật. Kết quả local không thay thế bước kiểm tra bản deployment Google và quyền tài khoản thực tế.

## Tài liệu nền tảng

- [google.script.run](https://developers.google.com/apps-script/guides/html/reference/run)
- [HTML Service iframe sandbox](https://developers.google.com/apps-script/guides/html/restrictions)
- [SpreadsheetApp.openById](https://developers.google.com/apps-script/reference/spreadsheet/spreadsheet-app#openById(String))
