# HƯỚNG DẪN: Đưa giao diện lên GitHub + Cloudflare Pages (backend vẫn là Apps Script)

## Mục tiêu của việc này

- **Dữ liệu vẫn nằm ở Google Sheets, backend vẫn là Apps Script** — không đổi gì cả.
- **Chỉ có giao diện (file `Index.html`)** được tách ra, đóng gói thành 1 trang web tĩnh,
  host trên Cloudflare Pages để tải nhanh hơn, có link gọn hơn, có thể gắn domain riêng.
- Giao diện trên Cloudflare gọi ngược về Apps Script bằng `fetch()` mỗi khi cần đọc/ghi
  dữ liệu (thay cho `google.script.run` chỉ chạy được khi trang do chính Apps Script phục vụ).

Sơ đồ:

```
Người dùng → Cloudflare Pages (trang tĩnh, index.html)
                    │  fetch() POST (JSON: {fn, args, adminToken})
                    ▼
             Apps Script Web App (doPost)  →  Google Sheets (dữ liệu thật)
```

---

## BƯỚC 0 — Deploy lại Apps Script với bản Code.gs mới (đã có doPost)

File `Code.gs` gửi kèm lần này có thêm hàm `doPost()` — đây là "cửa" nhận request
từ giao diện Cloudflare. Muốn cửa này hoạt động, phải deploy PHIÊN BẢN MỚI:

1. Mở Apps Script (Extensions → Apps Script trong Google Sheet).
2. Dán đè nội dung file **Code.gs** mới vào (đã có thêm phần `doPost`, `apiAdminLoginToken`,
   `apiGetBootstrap`...). File `Index.html` cũng dán đè bằng bản mới (đã bỏ cú pháp GAS,
   chuyển sang `fetch()`).
3. **Deploy → Manage deployments (Quản lý bản triển khai)** → bấm biểu tượng bút chì (Edit)
   trên bản deployment Web App đang dùng.
4. Ở mục **Version**, chọn **New version** (bắt buộc — nếu không chọn, code cũ vẫn chạy).
5. Kiểm tra lại **Who has access**: chọn **Anyone** (bắt buộc, để trang Cloudflare — chạy ở
   domain khác — gọi vào được; đây là cấu hình đã đổi từ trước cho tính năng Tìm kiếm công khai).
6. Bấm **Deploy**. Copy lại **URL Web app** (dạng `https://script.google.com/macros/s/AKfycb.../exec`).
   URL này thường KHÔNG đổi giữa các lần "New version" nếu deploy vào cùng 1 deployment cũ — nhưng
   cứ copy lại cho chắc.

> Lưu ý bảo mật đã áp dụng: mật khẩu Quản trị vẫn là điều kiện duy nhất để mở khóa các phân hệ
> quản lý trên giao diện. Khi gọi qua Cloudflare, Apps Script không còn nhận diện được tài khoản
> Google của người bấm (vì request đến từ 1 domain khác, không mang theo phiên đăng nhập Google) —
> nên hệ thống dùng 1 "token" tạm cấp sau khi nhập đúng mật khẩu (hết hạn sau 6 giờ) để xác nhận
> quyền ghi dữ liệu, thay cho việc đọc vai trò theo tài khoản Google như trước. Đánh đổi này giống
> hệt quyết định "chỉ dùng mật khẩu" đã chọn trước đó.

---

## BƯỚC 1 — Dán URL Apps Script vào giao diện

1. Mở file **Index.html** (bản mới) bằng trình soạn thảo bất kỳ (Notepad, VS Code...).
2. Tìm dòng:
   ```js
   var APPS_SCRIPT_URL = 'DÁN_URL_WEB_APP_APPS_SCRIPT_VÀO_ĐÂY';
   ```
3. Thay bằng URL đã copy ở Bước 0, ví dụ:
   ```js
   var APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxxxxxxxxxxx/exec';
   ```
4. Lưu file.

---

## BƯỚC 2 — Đưa lên GitHub

1. Vào [github.com](https://github.com) → **New repository** → đặt tên (VD: `tdkt-dhyd-ui`) →
   để **Public** hoặc **Private** đều được (Cloudflare Pages đọc được cả 2 nếu đã kết nối tài khoản
   GitHub) → **Create repository**.
2. Trong repo mới tạo, bấm **"uploading an existing file"** (hoặc "Add file → Upload files").
3. Kéo thả file **Index.html** (bản đã dán URL ở Bước 1) vào.
4. **QUAN TRỌNG:** khi upload, đổi tên file thành **`index.html`** (chữ thường toàn bộ) —
   Cloudflare Pages mặc định tìm file `index.html` chữ thường làm trang chủ; để nguyên
   `Index.html` chữ hoa có thể khiến trang chủ bị lỗi "404 Not Found".
5. Viết commit message bất kỳ (VD: "Giao diện TĐKT") → **Commit changes**.

Nếu quen dùng Git dòng lệnh, có thể làm nhanh hơn:
```bash
mkdir tdkt-dhyd-ui && cd tdkt-dhyd-ui
cp /đường/dẫn/tới/Index.html ./index.html
git init
git add index.html
git commit -m "Giao diện TĐKT"
git branch -M main
git remote add origin https://github.com/TEN_TAI_KHOAN/tdkt-dhyd-ui.git
git push -u origin main
```

---

## BƯỚC 3 — Kết nối Cloudflare Pages

1. Đăng nhập [dash.cloudflare.com](https://dash.cloudflare.com) → menu bên trái chọn
   **Workers & Pages** → **Create application** → tab **Pages** → **Connect to Git**.
2. Chọn tài khoản GitHub (cấp quyền nếu được hỏi lần đầu) → chọn repo `tdkt-dhyd-ui` vừa tạo.
3. Ở màn hình **Set up builds and deployments**:
   - **Framework preset:** chọn **None** (đây là trang tĩnh, không cần build).
   - **Build command:** để **trống**.
   - **Build output directory:** để **`/`** (thư mục gốc — vì `index.html` nằm ngay gốc repo).
4. Bấm **Save and Deploy**. Đợi khoảng 30–60 giây, Cloudflare sẽ cấp cho 1 link dạng:
   `https://tdkt-dhyd-ui.pages.dev`
5. Mở link đó — đây chính là link mới, tải nhanh hơn, gửi cho mọi người dùng thay cho link
   Apps Script cũ. Trang Tìm kiếm vẫn công khai như trước; các tab còn lại vẫn cần mật khẩu Quản trị.

### Tự động cập nhật sau này

Từ giờ, mỗi khi sửa `index.html` và **push lên nhánh `main` trên GitHub**, Cloudflare Pages sẽ
**tự động build lại và cập nhật trang** trong khoảng 1 phút — không cần thao tác gì thêm bên
Cloudflare.

### Gắn domain riêng (tùy chọn)

Nếu trường có domain riêng (VD: `tdkt.uphcm.edu.vn`): vào project vừa tạo trên Cloudflare Pages →
tab **Custom domains** → **Set up a custom domain** → làm theo hướng dẫn (cần domain đó đã hoặc sẽ
trỏ DNS qua Cloudflare).

---

## Kiểm tra sau khi triển khai

1. Mở link Cloudflare (`...pages.dev`) bằng trình duyệt ẩn danh (Incognito).
2. Tab **🔍 Tìm kiếm** phải hiện ngay, không cần đăng nhập.
3. Bấm **🔒 Đăng nhập Quản trị**, nhập đúng mật khẩu — các tab quản trị phải hiện ra và tải được
   dữ liệu (Danh mục đơn vị, Danh sách cá nhân...).
4. Thử **Thêm** hoặc **Sửa** 1 dòng dữ liệu bất kỳ để chắc chắn chiều ghi dữ liệu hoạt động.
5. Nếu gặp lỗi **không tải được dữ liệu / lỗi CORS** ngay bước 2–3:
   - Kiểm tra lại `APPS_SCRIPT_URL` trong `index.html` đã đúng URL `.../exec` chưa (không phải
     link dạng `.../edit` của Google Sheet).
   - Kiểm tra Apps Script **Who has access = Anyone** (Bước 0.5).
   - Kiểm tra đã **Deploy phiên bản mới (New version)** sau khi dán code `doPost` mới, chưa chỉ
     lưu (Save) mà quên Deploy lại.

---

## Từ nay khi cần sửa giao diện

- Sửa `index.html` (bản trên máy) → upload đè lên GitHub (hoặc `git add` + `git commit` + `git push`)
  → Cloudflare tự cập nhật, không cần đụng gì tới Apps Script.
- Chỉ khi nào **sửa `Code.gs` hoặc `RuleEngine.gs`** (đổi cách tính toán, thêm API mới...) thì mới
  cần vào lại Apps Script → **Deploy → Manage deployments → New version** như Bước 0.
