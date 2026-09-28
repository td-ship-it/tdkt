/**
 * HỆ THỐNG QUẢN LÝ THI ĐUA KHEN THƯỞNG - ĐHYD TP.HCM
 * Nền tảng: Google Sheets + Google Apps Script (Web App)
 * Căn cứ: Quy chế TĐKT ban hành kèm NQ 45/NQ-HĐT ngày 18/6/2025
 * Phạm vi: KHÔNG bao gồm nội dung liên quan lực lượng vũ trang/công an nhân dân
 *
 * CÁCH DÙNG: Xem file SETUP_GUIDE.md đi kèm để triển khai.
 */

// ============================================================
// 1. CẤU HÌNH DANH MỤC SHEET & CỘT
// ============================================================
const SHEET_DONVI       = 'DonVi';
const SHEET_NGUOIDUNG   = 'NguoiDung';
const SHEET_CANHAN      = 'CaNhan';
const SHEET_TT_CANHAN   = 'ThanhTichCaNhan';
const SHEET_TT_TAPTHE   = 'ThanhTichTapThe';
const SHEET_NHATKY      = 'NhatKy';
const SHEET_SANGKIEN         = 'SangKien';
const SHEET_THANHVIEN_SANGKIEN = 'ThanhVienSangKien';

const HEADERS = {};
HEADERS[SHEET_DONVI]     = ['MaDonVi', 'TenDonVi', 'LoaiHinh', 'GhiChu'];
HEADERS[SHEET_NGUOIDUNG] = ['Email', 'HoTen', 'DonVi', 'VaiTro', 'MaNV'];
HEADERS[SHEET_CANHAN]    = ['MaNV', 'HoTen', 'DonVi', 'ChucVu', 'GhiChu'];
// LƯU Ý: NgayQD, NoiBanHanh được thêm ở CUỐI (không chèn giữa) để không phá vỡ dữ liệu cũ đã nhập.
// LƯU Ý: NgayQD, NoiBanHanh, LinkMinhChung được thêm ở CUỐI (không chèn giữa) để không phá vỡ dữ liệu cũ đã nhập.
HEADERS[SHEET_TT_CANHAN] = ['ID', 'MaNV', 'Nam', 'MucHoanThanh', 'DanhHieuDat', 'TenSangKien', 'PhamVi', 'SoQD', 'GhiChu', 'NgayCapNhat', 'NguoiCapNhat', 'NgayQD', 'NoiBanHanh', 'LinkMinhChung'];
HEADERS[SHEET_TT_TAPTHE] = ['ID', 'DonVi', 'Nam', 'MucHoanThanh', 'KhongKyLuat', 'DanhHieuDat', 'SoQD', 'GhiChu', 'NgayCapNhat', 'NguoiCapNhat', 'NgayQD', 'NoiBanHanh', 'LinkMinhChung'];
HEADERS[SHEET_NHATKY]    = ['Timestamp', 'User', 'HanhDong', 'ChiTiet'];
// SangKien: mỗi dòng là 1 sáng kiến/đề tài — MaSK là mã riêng để tra cứu & tránh trùng khi dùng để xét danh hiệu.
HEADERS[SHEET_SANGKIEN] = ['MaSK', 'TenSangKien', 'Nam', 'PhamVi', 'SoQD', 'NgayQD', 'NoiBanHanh', 'LinkMinhChung', 'GhiChu', 'NgayCapNhat', 'NguoiCapNhat'];
// ThanhVienSangKien: quan hệ nhiều-nhiều giữa SangKien và CaNhan — mỗi người tham gia 1 sáng kiến có
// % đóng góp riêng, và trạng thái "đã dùng để xét danh hiệu" RIÊNG CHO TỪNG NGƯỜI (người này dùng rồi
// không ảnh hưởng người khác cùng tham gia sáng kiến đó — mỗi người chỉ dùng ĐÚNG phần đóng góp của mình 1 lần).
HEADERS[SHEET_THANHVIEN_SANGKIEN] = ['ID', 'MaSK', 'MaNV', 'TyLeDongGop', 'DaDungXet', 'DanhHieuDaXet', 'NamXet', 'NgayCapNhat', 'NguoiCapNhat'];

// "— Không áp dụng —" dùng cho các dòng CHỈ khai báo 1 quyết định về danh hiệu/hình thức khen thưởng
// (VD: QĐ tặng Giấy khen, QĐ tặng Bằng khen Bộ Y tế...) — KHÔNG phải là quyết định đánh giá mức
// hoàn thành nhiệm vụ. Nhờ đó 1 năm có thể tách thành nhiều dòng, mỗi dòng đúng 1 quyết định riêng
// (đúng thực tế: 1 năm có thể có QĐ đánh giá mức hoàn thành NV + QĐ danh hiệu thi đua + nhiều QĐ
// khen thưởng khác nhau, mỗi QĐ có số/ngày/nơi ban hành riêng).
const MUC_KHONG_AP_DUNG = '— Không áp dụng (dòng này chỉ khai báo danh hiệu/khen thưởng) —';
const COMPLETION_LEVELS = [MUC_KHONG_AP_DUNG, 'Không hoàn thành nhiệm vụ', 'Hoàn thành nhiệm vụ', 'Hoàn thành tốt nhiệm vụ', 'Hoàn thành xuất sắc nhiệm vụ'];

// Danh mục ĐẦY ĐỦ danh hiệu thi đua + hình thức khen thưởng theo Quy chế TĐKT (NQ 45/NQ-HĐT, 18/6/2025)
// Loại trừ nội dung liên quan lực lượng vũ trang/công an nhân dân (Huân chương Quân công, Chiến công, Bảo vệ Tổ quốc...).
// Mỗi mục gồm: nhóm (dùng để gộp <optgroup> trên giao diện) + tên danh hiệu.
const DANHHIEU_CN_GROUPS = [
  { nhom: 'Danh hiệu thi đua', items: [
    'Lao động tiên tiến',
    'Chiến sĩ thi đua cơ sở',
    'Chiến sĩ thi đua cấp Bộ',
    'Chiến sĩ thi đua toàn quốc'
  ]},
  { nhom: 'Hình thức khen thưởng', items: [
    'Giấy khen Hiệu trưởng',
    'Bằng khen Bộ trưởng Bộ Y tế',
    'Bằng khen Thủ tướng Chính phủ',
    'Kỷ niệm chương "Vì sức khỏe nhân dân"',
    'Kỷ niệm chương "Vì sự nghiệp giáo dục"'
  ]},
  { nhom: 'Danh hiệu vinh dự Nhà nước', items: [
    'Thầy thuốc Ưu tú',
    'Thầy thuốc Nhân dân',
    'Nhà giáo Ưu tú',
    'Nhà giáo Nhân dân',
    'Anh hùng Lao động'
  ]},
  { nhom: 'Huân chương', items: [
    'Huân chương Lao động hạng Ba',
    'Huân chương Lao động hạng Nhì',
    'Huân chương Lao động hạng Nhất',
    'Huân chương Độc lập hạng Ba',
    'Huân chương Độc lập hạng Nhì',
    'Huân chương Độc lập hạng Nhất',
    'Huân chương Hồ Chí Minh',
    'Huân chương Sao vàng'
  ]},
  { nhom: 'Giải thưởng', items: [
    'Giải thưởng Nhà nước',
    'Giải thưởng Hồ Chí Minh'
  ]}
];

const DANHHIEU_TT_GROUPS = [
  { nhom: 'Danh hiệu thi đua', items: [
    'Tập thể lao động tiên tiến',
    'Tập thể lao động xuất sắc',
    'Cờ thi đua Bộ Y tế',
    'Cờ thi đua Chính phủ'
  ]},
  { nhom: 'Hình thức khen thưởng', items: [
    'Giấy khen Hiệu trưởng',
    'Bằng khen Bộ trưởng Bộ Y tế',
    'Bằng khen Thủ tướng Chính phủ'
  ]},
  { nhom: 'Danh hiệu vinh dự Nhà nước', items: [
    'Anh hùng Lao động'
  ]},
  { nhom: 'Huân chương', items: [
    'Huân chương Lao động hạng Ba',
    'Huân chương Lao động hạng Nhì',
    'Huân chương Lao động hạng Nhất',
    'Huân chương Độc lập hạng Ba',
    'Huân chương Độc lập hạng Nhì',
    'Huân chương Độc lập hạng Nhất',
    'Huân chương Hồ Chí Minh',
    'Huân chương Sao vàng'
  ]},
  { nhom: 'Giải thưởng', items: [
    'Giải thưởng Nhà nước',
    'Giải thưởng Hồ Chí Minh'
  ]}
];

// Danh sách phẳng (dùng để validate ở backend) — tự động gộp từ các nhóm trên + "Không đạt"
function flattenDanhHieu_(groups) {
  var arr = ['Không đạt'];
  groups.forEach(function (g) { g.items.forEach(function (i) { arr.push(i); }); });
  return arr;
}
const DANHHIEU_CN = flattenDanhHieu_(DANHHIEU_CN_GROUPS);
const DANHHIEU_TT = flattenDanhHieu_(DANHHIEU_TT_GROUPS);

// Nơi ban hành quyết định — theo đúng thẩm quyền quy định tại Chương IV Quy chế
const NOI_BAN_HANH = [
  'Đại học Y Dược TP.HCM',
  'Bộ Y tế',
  'Bộ Giáo dục và Đào tạo',
  'Thủ tướng Chính phủ',
  'Chủ tịch nước',
  'Khác'
];

const PHAM_VI = ['Cơ sở/Đơn vị', 'Cấp Bộ/Ngành/Tỉnh', 'Toàn quốc'];
const LOAI_HINH_VALID = ['Bộ môn', 'Phòng chức năng', 'Tập thể lớn'];
const ROLES = ['Admin', 'TCCB', 'TruongDonVi', 'HoiDong', 'CaNhan'];
// Quyền được chỉnh sửa dữ liệu (nhập/sửa thành tích, danh mục)
const ROLES_EDIT = ['Admin', 'TCCB', 'TruongDonVi'];
// Quyền xem toàn trường
const ROLES_VIEW_ALL = ['Admin', 'TCCB', 'HoiDong'];

// ============================================================
// 2. KHỞI TẠO HỆ THỐNG (chạy 1 lần từ menu bảng tính)
// ============================================================
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('⭐ Hệ thống TĐKT')
    .addItem('1. Khởi tạo hệ thống (chạy 1 lần đầu)', 'initializeSystem')
    .addItem('2. Lấy link Web App', 'showWebAppInstructions')
    .addItem('3. Cập nhật cấu trúc dữ liệu (khi có cột mới)', 'menuCapNhatCauTrucDuLieu')
    .addItem('4. Đặt/đổi mật khẩu Quản trị (mở khóa giao diện admin)', 'menuDatMatKhauAdmin')
    .addToUi();
}

// ============================================================
// MẬT KHẨU QUẢN TRỊ — chỉ mở khóa GIAO DIỆN cho người chưa được cấp quyền
// trong sheet NguoiDung. Đây KHÔNG phải cơ chế bảo mật thay thế phân quyền —
// mọi thao tác ghi dữ liệu (Thêm/Sửa/Xóa) vẫn bắt buộc qua requireRole_()
// dựa trên đúng tài khoản Google đã đăng ký vai trò. Xem thêm SETUP_GUIDE.md.
// ============================================================
function menuDatMatKhauAdmin() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.prompt('Đặt mật khẩu Quản trị', 'Nhập mật khẩu mới (dùng để mở khóa giao diện admin cho người chưa có tài khoản đăng ký):', ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;
  const pw = resp.getResponseText().trim();
  if (!pw) { ui.alert('Mật khẩu không được để trống.'); return; }
  PropertiesService.getScriptProperties().setProperty('ADMIN_UI_PASSWORD', pw);
  ui.alert('Đã đặt mật khẩu Quản trị mới. Hãy thông báo mật khẩu này cho những người cần dùng.');
}

// Chống dò mật khẩu (brute-force): sai quá SO_LAN_TOI_DA lần trong 1 khoảng thời gian ngắn
// sẽ bị khóa tạm THOI_GIAN_KHOA_GIAY giây, không cho thử tiếp — dù đoán đúng cũng bị chặn
// trong lúc đang khóa. Đây là khóa DÙNG CHUNG cho mọi người truy cập (không phân biệt từng
// người), đơn giản nhưng đủ hiệu quả để chặn script dò mật khẩu tự động ở quy mô nội bộ.
const ADMIN_PW_SO_LAN_TOI_DA = 5;
const ADMIN_PW_THOI_GIAN_KHOA_GIAY = 300; // 5 phút

function apiCheckAdminPassword(pw) {
  const cache = CacheService.getScriptCache();
  const KEY_KHOA = 'ADMIN_PW_LOCKOUT';
  const KEY_SO_LAN_SAI = 'ADMIN_PW_FAILCOUNT';

  if (cache.get(KEY_KHOA)) return false; // đang trong thời gian bị khóa do sai quá nhiều lần

  const saved = PropertiesService.getScriptProperties().getProperty('ADMIN_UI_PASSWORD');
  if (!saved) return false; // chưa đặt mật khẩu -> không cho mở khóa qua đường này

  const dung = String(pw || '').trim() === saved;
  if (dung) {
    cache.remove(KEY_SO_LAN_SAI);
    return true;
  }

  const soLanSai = Number(cache.get(KEY_SO_LAN_SAI) || '0') + 1;
  cache.put(KEY_SO_LAN_SAI, String(soLanSai), 600);
  if (soLanSai >= ADMIN_PW_SO_LAN_TOI_DA) {
    cache.put(KEY_KHOA, '1', ADMIN_PW_THOI_GIAN_KHOA_GIAY);
    logAction_('Khóa tạm đăng nhập Quản trị', 'Sai mật khẩu ' + soLanSai + ' lần liên tiếp');
  }
  return false;
}

// ------------------------------------------------------------------
// Đăng nhập admin bằng TOKEN — dùng khi giao diện chạy tách rời (Cloudflare
// Pages) và gọi ngược về đây qua fetch()/doPost(). Lúc đó KHÔNG có phiên đăng
// nhập Google đính kèm request (Session.getActiveUser() trả rỗng), nên không
// thể dựa vào vai trò tài khoản Google như đường doGet cũ. Thay vào đó: sau khi
// gõ đúng mật khẩu admin, server phát 1 token ngẫu nhiên, lưu tạm trong Cache
// (tối đa 6 giờ - giới hạn của CacheService); mọi request ghi dữ liệu sau đó
// phải đính kèm token này để được xem là "Admin" (xem requireRole_ bên dưới).
// ------------------------------------------------------------------
const ADMIN_TOKEN_HAN_GIAY = 6 * 60 * 60; // 6 giờ (tối đa CacheService cho phép)

function apiAdminLoginToken(pw) {
  const ok = apiCheckAdminPassword(pw);
  if (!ok) return { ok: false };
  const token = Utilities.getUuid();
  CacheService.getScriptCache().put('ADMIN_TOKEN_' + token, '1', ADMIN_TOKEN_HAN_GIAY);
  return { ok: true, token: token };
}

function apiAdminLogout(token) {
  if (token) CacheService.getScriptCache().remove('ADMIN_TOKEN_' + token);
  return true;
}

function isValidAdminToken_(token) {
  if (!token) return false;
  return CacheService.getScriptCache().get('ADMIN_TOKEN_' + token) === '1';
}

function initializeSystem() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(HEADERS).forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    if (sheet.getRange(1, 1).getValue() === '') {
      var headerRange = sheet.getRange(1, 1, 1, HEADERS[name].length);
      headerRange.setValues([HEADERS[name]]);
      headerRange.setFontWeight('bold').setBackground('#2E75B6').setFontColor('#FFFFFF');
      sheet.setFrozenRows(1);
      sheet.autoResizeColumns(1, HEADERS[name].length);
    }
  });
  seedDefaultUnits();
  seedAdminUser();
  capNhatCauTrucDuLieu(); // đảm bảo sheet đã tồn tại từ trước cũng được bổ sung cột mới (nếu có)
  SpreadsheetApp.getUi().alert(
    'Khởi tạo hoàn tất!\n\n' +
    'Tài khoản của bạn (' + Session.getActiveUser().getEmail() + ') đã được cấp quyền Admin.\n\n' +
    'Bước tiếp theo: Vào menu Extensions/Tiện ích mở rộng > Apps Script > Deploy > New deployment > ' +
    'chọn loại "Web app" để lấy đường link sử dụng.'
  );
}

// Bổ sung cột mới vào các sheet ĐÃ CÓ SẴN dữ liệu (không xóa/động vào dữ liệu cũ) —
// dùng khi nâng cấp hệ thống có thêm trường mới (VD: NgayQD, NoiBanHanh).
// An toàn để chạy nhiều lần: cột đã tồn tại sẽ được bỏ qua, không tạo trùng.
function capNhatCauTrucDuLieu() {
  const ss = SpreadsheetApp.getActive();
  var tongSoCotDaThem = 0;
  var chiTiet = [];
  Object.keys(HEADERS).forEach(function (name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) return;
    var soCotHienTai = sheet.getLastColumn();
    var headerHienTai = soCotHienTai > 0 ? sheet.getRange(1, 1, 1, soCotHienTai).getValues()[0] : [];
    var thieu = HEADERS[name].filter(function (h) { return headerHienTai.indexOf(h) === -1; });
    if (thieu.length > 0) {
      var startCol = soCotHienTai + 1;
      var range = sheet.getRange(1, startCol, 1, thieu.length);
      range.setValues([thieu]);
      range.setFontWeight('bold').setBackground('#2E75B6').setFontColor('#FFFFFF');
      sheet.autoResizeColumns(startCol, thieu.length);
      tongSoCotDaThem += thieu.length;
      chiTiet.push(name + ': +' + thieu.join(', '));
    }
  });
  if (tongSoCotDaThem > 0) {
    logAction_('Cập nhật cấu trúc dữ liệu', chiTiet.join(' | '));
  }
  return { tongSoCotDaThem: tongSoCotDaThem, chiTiet: chiTiet };
}

function menuCapNhatCauTrucDuLieu() {
  var ketQua = capNhatCauTrucDuLieu();
  if (ketQua.tongSoCotDaThem === 0) {
    SpreadsheetApp.getUi().alert('Cấu trúc dữ liệu đã đầy đủ, không có cột nào cần bổ sung.');
  } else {
    SpreadsheetApp.getUi().alert(
      'Đã bổ sung ' + ketQua.tongSoCotDaThem + ' cột mới:\n\n' + ketQua.chiTiet.join('\n') +
      '\n\nDữ liệu cũ không bị ảnh hưởng.'
    );
  }
}

function seedDefaultUnits() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_DONVI);
  if (sheet.getLastRow() > 1) return;
  const rows = [];
  for (var i = 1; i <= 12; i++) {
    rows.push(['DV' + String(i).padStart(2, '0'), 'Bộ môn ' + i, 'Bộ môn', '']);
  }
  for (var j = 1; j <= 3; j++) {
    rows.push(['DV' + String(12 + j).padStart(2, '0'), 'Phòng chức năng ' + j, 'Phòng chức năng', '']);
  }
  rows.push(['DV16', 'Trường Dược (tập thể lớn)', 'Tập thể lớn', '']);
  sheet.getRange(2, 1, rows.length, 4).setValues(rows);
}

function seedAdminUser() {
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET_NGUOIDUNG);
  if (sheet.getLastRow() > 1) return;
  const email = Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail();
  sheet.getRange(2, 1, 1, 5).setValues([[email, 'Quản trị hệ thống', '', 'Admin', '']]);
}

function showWebAppInstructions() {
  SpreadsheetApp.getUi().alert(
    'Vào Extensions (Tiện ích mở rộng) > Apps Script.\n' +
    'Trong trình soạn thảo: Deploy (Triển khai) > New deployment (Bản triển khai mới).\n' +
    'Chọn loại "Web app". Execute as: Me. Who has access: chọn phù hợp tổ chức của bạn.\n' +
    'Bấm Deploy để lấy đường link Web App.'
  );
}

// ============================================================
// 3. TIỆN ÍCH ĐỌC/GHI SHEET
// ============================================================
function getSheet_(name) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sheet) throw new Error('Chưa khởi tạo hệ thống. Vào menu "⭐ Hệ thống TĐKT" > "Khởi tạo hệ thống" trước.');
  return sheet;
}

// Đọc ĐÚNG dòng tiêu đề thực tế (dòng 1) của sheet — dùng để ánh xạ dữ liệu theo TÊN CỘT,
// KHÔNG giả định thứ tự cột cố định theo hằng số HEADERS. Sheet có thể lệch thứ tự so với
// HEADERS[sheetName] do lịch sử nâng cấp cấu trúc dữ liệu (thêm cột) qua nhiều lần trước đây —
// đọc/ghi theo tên cột thực tế giúp hệ thống LUÔN ĐÚNG bất kể thứ tự cột thực sự trong Sheet.
// Ánh xạ các cách đặt tên cột "thân thiện" (tiếng Việt có dấu/khoảng trắng) sang đúng tên kỹ
// thuật mà code dùng nội bộ — phòng trường hợp ai đó đổi tên tiêu đề cột trực tiếp trong Sheet
// cho dễ đọc (VD: "Ngày QĐ" thay vì "NgayQD"), tránh lặp lại lỗi cột bị "biến mất" khỏi hệ thống.
const BIET_DANH_COT_ = {
  'Ngày QĐ': 'NgayQD', 'Ngay QD': 'NgayQD', 'NgayQd': 'NgayQD',
  'Nơi ban hành': 'NoiBanHanh', 'Noi ban hanh': 'NoiBanHanh',
  'Minh chứng': 'LinkMinhChung', 'MinhChung': 'LinkMinhChung', 'Minh chung': 'LinkMinhChung', 'Link minh chứng': 'LinkMinhChung',
  'Ghi chú': 'GhiChu', 'Ghi chu': 'GhiChu',
  'Số QĐ': 'SoQD', 'So QD': 'SoQD',
  'Mã NV': 'MaNV', 'Ma NV': 'MaNV',
  'Họ tên': 'HoTen', 'Ho ten': 'HoTen',
  'Đơn vị': 'DonVi', 'Don vi': 'DonVi',
  'Năm': 'Nam',
  'Mức hoàn thành': 'MucHoanThanh', 'Muc hoan thanh': 'MucHoanThanh',
  'Danh hiệu đạt': 'DanhHieuDat', 'Danh hieu dat': 'DanhHieuDat',
  'Tên sáng kiến': 'TenSangKien', 'Ten sang kien': 'TenSangKien',
  'Phạm vi': 'PhamVi', 'Pham vi': 'PhamVi'
};

function layHeaderThucTe_(sheetName) {
  const sheet = getSheet_(sheetName);
  const soCot = sheet.getLastColumn();
  if (soCot === 0) return HEADERS[sheetName].slice();
  const hang1 = sheet.getRange(1, 1, 1, soCot).getValues()[0];
  return hang1.map(function (h) {
    var ten = String(h).trim();
    return BIET_DANH_COT_[ten] || ten; // đổi về đúng tên kỹ thuật nếu khớp 1 biệt danh đã biết
  });
}

function readSheetAsObjects_(sheetName) {
  const sheet = getSheet_(sheetName);
  if (sheet.getLastRow() < 2) return [];
  const headers = layHeaderThucTe_(sheetName); // ĐÚNG theo tên cột thực tế trong Sheet
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  return values
    .filter(function (row) { return row.some(function (c) { return c !== '' && c !== null; }); })
    .map(function (row) {
      var obj = {};
      headers.forEach(function (h, i) {
        if (!h) return; // bỏ qua cột không có tên (trống, có thể do lỗi nhập liệu cũ)
        var v = row[i];
        // Tự động cắt khoảng trắng thừa đầu/cuối cho các cột dạng text.
        // Tránh trường hợp mã (MaNV, MaDonVi, ID...) trông giống hệt nhau trên UI nhưng
        // lệch nhau ở khoảng trắng ẩn khiến so sánh chuỗi (===) bị sai lệch.
        if (typeof v === 'string') v = v.trim();
        // QUAN TRỌNG: chuyển Date object thành chuỗi ISO trước khi trả về client.
        // google.script.run có thể serialize sai (trả về null) nếu object trả về
        // chứa Date "sống" chưa được chuyển thành text — đây là nguyên nhân khiến
        // toàn bộ dòng dữ liệu bị "biến mất" phía client dù server đọc đúng.
        if (v instanceof Date) {
          // Cột "NgayQD" là ngày người dùng chọn qua <input type="date">, Google Sheets có thể
          // tự nhận diện thành ô Date khi lưu. Định dạng lại đúng theo giờ VN (GMT+7) dạng
          // yyyy-MM-dd (chuẩn ISO ngày, tương thích ngược để hiển thị lại đúng vào <input type="date">
          // khi Sửa) — tránh bị lệch 1 ngày do UTC và tránh hiện dư giờ-phút-giây khi hiển thị.
          if (h === 'NgayQD') {
            v = Utilities.formatDate(v, 'GMT+7', 'yyyy-MM-dd');
          } else {
            v = v.toISOString();
          }
        }
        obj[h] = v;
      });
      return obj;
    });
}

// Thêm 1 dòng mới — nhận vào OBJECT (khóa = tên cột) thay vì mảng theo vị trí, để luôn ghi
// ĐÚNG cột dù thứ tự cột thực tế trong Sheet có khác thứ tự khai báo trong HEADERS hay không.
function appendRow_(sheetName, dataObj) {
  const headers = layHeaderThucTe_(sheetName);
  const row = headers.map(function (h) {
    return Object.prototype.hasOwnProperty.call(dataObj, h) ? dataObj[h] : '';
  });
  getSheet_(sheetName).appendRow(row);
}

// Cập nhật 1 dòng theo cột khóa (keyCol) = keyVal, ghi đè các field trong patchObj
function updateRowByKey_(sheetName, keyCol, keyVal, patchObj) {
  const sheet = getSheet_(sheetName);
  const headers = layHeaderThucTe_(sheetName);
  const keyIdx = headers.indexOf(keyCol);
  if (sheet.getLastRow() < 2) return false;
  const key = String(keyVal).trim();
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  for (var r = 0; r < values.length; r++) {
    if (String(values[r][keyIdx]).trim() === key) {
      headers.forEach(function (h, i) {
        if (Object.prototype.hasOwnProperty.call(patchObj, h)) {
          sheet.getRange(r + 2, i + 1).setValue(patchObj[h]);
        }
      });
      return true;
    }
  }
  return false;
}

// Xóa 1 dòng theo cột khóa (keyCol) = keyVal. Trả về true nếu đã xóa.
function deleteRowByKey_(sheetName, keyCol, keyVal) {
  const sheet = getSheet_(sheetName);
  const headers = layHeaderThucTe_(sheetName);
  const keyIdx = headers.indexOf(keyCol);
  if (sheet.getLastRow() < 2) return false;
  const key = String(keyVal).trim();
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getValues();
  for (var r = 0; r < values.length; r++) {
    if (String(values[r][keyIdx]).trim() === key) {
      sheet.deleteRow(r + 2);
      return true;
    }
  }
  return false;
}

// Đếm số dòng có cột colName = value (dùng để kiểm tra ràng buộc trước khi xóa)
function countRowsWhere_(sheetName, colName, value) {
  var key = String(value).trim();
  return readSheetAsObjects_(sheetName).filter(function (row) {
    return String(row[colName]).trim() === key;
  }).length;
}

// Kiểm tra còn sót dữ liệu mẫu (GhiChu = "Dữ liệu mẫu") ở đâu không — dùng để cảnh báo trên giao diện
function apiCheckSampleData() {
  const marker = 'Dữ liệu mẫu';
  const caNhan = countRowsWhere_(SHEET_CANHAN, 'GhiChu', marker);
  const thanhTichCN = countRowsWhere_(SHEET_TT_CANHAN, 'GhiChu', marker);
  const thanhTichTT = countRowsWhere_(SHEET_TT_TAPTHE, 'GhiChu', marker);
  return {
    caNhan: caNhan, thanhTichCN: thanhTichCN, thanhTichTT: thanhTichTT,
    tong: caNhan + thanhTichCN + thanhTichTT
  };
}

// Trả về thông tin file Sheet mà bản Web App đang chạy này thực sự đang đọc/ghi —
// dùng để đối chiếu với URL Sheet đang mở trên trình duyệt, phát hiện trường hợp
// đang thao tác nhầm 2 bản Sheet/2 project Apps Script khác nhau.
// Gói toàn bộ dữ liệu "khởi động" mà giao diện cần ngay khi mở trang — trước đây
// được nhúng sẵn vào HTML qua templating GAS (<?!= ... ?>), nay giao diện chạy
// tách rời (Cloudflare Pages) nên phải gọi 1 API để lấy về qua fetch().
function apiGetBootstrap() {
  return {
    user: getCurrentUser(),
    completionLevels: COMPLETION_LEVELS,
    danhHieuCnGroups: DANHHIEU_CN_GROUPS,
    danhHieuTtGroups: DANHHIEU_TT_GROUPS,
    noiBanHanh: NOI_BAN_HANH,
    phamVi: PHAM_VI
  };
}

function apiGetSystemInfo() {
  const ss = SpreadsheetApp.getActive();
  return {
    tenFile: ss.getName(),
    idFile: ss.getId(),
    urlFile: ss.getUrl(),
    soDongCaNhan: getSheet_(SHEET_CANHAN).getLastRow() - 1,
    soDongThanhTichCN: getSheet_(SHEET_TT_CANHAN).getLastRow() - 1,
    thoiGianKiemTra: new Date().toISOString()
  };
}

// ============================================================
// TIỆN ÍCH CSV (dùng cho xuất file mẫu / nhập dữ liệu hàng loạt)
// ============================================================
function toCsvRow_(arr) {
  return arr.map(function (v) {
    var s = (v === null || v === undefined) ? '' : String(v);
    if (s.indexOf(',') !== -1 || s.indexOf('"') !== -1 || s.indexOf('\n') !== -1) {
      s = '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }).join(',');
}

// Parser CSV đơn giản, hỗ trợ dấu phẩy/xuống dòng trong ngoặc kép
function parseCsv_(text) {
  // Bỏ BOM (Byte Order Mark) nếu có — thường xuất hiện khi file được lưu từ Excel dạng UTF-8,
  // nếu không bỏ sẽ khiến tên cột ĐẦU TIÊN (VD: "MaNV") không khớp được vì bị dính ký tự ẩn phía trước.
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

  // TỰ ĐỘNG NHẬN DIỆN dấu phân cách: dấu phẩy (,) chuẩn hoặc dấu chấm phẩy (;) — rất hay gặp khi
  // file CSV được MỞ LẠI VÀ LƯU BẰNG EXCEL với cấu hình vùng Việt Nam (Excel tự đổi dấu phân cách
  // danh sách thành ";" theo Regional Settings của Windows). Nếu không tự nhận diện, toàn bộ cột
  // sẽ bị lệch/đọc sai (khiến các cột bắt buộc như "Mức hoàn thành" luôn đọc ra rỗng).
  var dongDau = text.split(/\r\n|\r|\n/)[0] || '';
  var soPhay = (dongDau.match(/,/g) || []).length;
  var soChamPhay = (dongDau.match(/;/g) || []).length;
  var delimiter = soChamPhay > soPhay ? ';' : ',';

  const rows = [];
  let row = [], field = '', inQuotes = false;
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (var i = 0; i < text.length; i++) {
    var c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else {
        field += c;
      }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === delimiter) { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else { field += c; }
    }
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter(function (r) { return r.some(function (c) { return String(c).trim() !== ''; }); });
}

// ============================================================
// 4. XÁC THỰC & PHÂN QUYỀN
// ============================================================
function getCurrentUser() {
  const email = Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail();
  const users = readSheetAsObjects_(SHEET_NGUOIDUNG);
  const found = users.filter(function (u) { return u.Email === email; })[0];
  if (!found) {
    return { email: email, hoTen: '', donVi: '', vaiTro: null, maNV: '' };
  }
  return { email: email, hoTen: found.HoTen, donVi: found.DonVi, vaiTro: found.VaiTro, maNV: found.MaNV };
}

// Biến toàn cục tạm thời trong 1 lần thực thi: doPost() gán token admin (nếu có)
// gửi kèm từ giao diện Cloudflare vào đây trước khi gọi hàm apiXxx tương ứng.
// Đường doGet/google.script.run cũ (chạy trong domain Apps Script) không dùng biến
// này, vẫn xét quyền theo tài khoản Google như trước.
var __REQUEST_ADMIN_TOKEN__ = null;

function requireRole_(allowedRoles) {
  const user = getCurrentUser();
  if (user.vaiTro && allowedRoles.indexOf(user.vaiTro) !== -1) {
    return user;
  }
  // Không xác định được vai trò qua tài khoản Google (thường gặp khi gọi qua
  // fetch() cross-domain từ giao diện tách rời) -> cho phép qua nếu đã đăng
  // nhập đúng mật khẩu admin (token còn hiệu lực). Đây là quyết định thiết kế
  // đã chọn: xác thực chỉ bằng mật khẩu, chấp nhận đánh đổi không truy vết
  // chính xác từng người theo tài khoản Google.
  if (__REQUEST_ADMIN_TOKEN__ && isValidAdminToken_(__REQUEST_ADMIN_TOKEN__)) {
    return {
      email: user.email || '',
      hoTen: user.hoTen || 'Quản trị (qua mật khẩu)',
      donVi: user.donVi || '',
      vaiTro: 'Admin',
      maNV: user.maNV || ''
    };
  }
  throw new Error('Bạn không có quyền thực hiện thao tác này. Liên hệ Phòng TCCB để được cấp quyền phù hợp.');
}

function logAction_(hanhDong, chiTiet) {
  const user = getCurrentUser();
  appendRow_(SHEET_NHATKY, { Timestamp: new Date(), User: user.email, HanhDong: hanhDong, ChiTiet: chiTiet });
}

// ============================================================
// 5. WEB APP ENTRY POINT
// ============================================================
function doGet(e) {
  const user = getCurrentUser();
  const template = HtmlService.createTemplateFromFile('Index');
  template.user = user;
  template.completionLevels = COMPLETION_LEVELS;
  template.danhHieuCnGroups = DANHHIEU_CN_GROUPS;
  template.danhHieuTtGroups = DANHHIEU_TT_GROUPS;
  template.noiBanHanh = NOI_BAN_HANH;
  template.phamVi = PHAM_VI;
  return template.evaluate()
    .setTitle('Hệ thống TĐKT - ĐHYD TP.HCM')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// ============================================================
// 5b. doPost — CỔNG API CHO GIAO DIỆN CHẠY TÁCH RỜI (Cloudflare Pages, v.v.)
// ============================================================
// Giao diện tĩnh gọi vào đây bằng fetch(), gửi JSON dạng:
//   { fn: "apiTenHam", args: [...], adminToken: "..." (nếu có, sau khi đăng nhập admin) }
// Trả về luôn là JSON: { ok: true, data: ... } hoặc { ok: false, error: "..." }
//
// AN TOÀN: chỉ những tên hàm có trong DANH_SACH_HAM_CHO_PHEP_ bên dưới mới được
// gọi — tuyệt đối không dùng eval/this[fn] trực tiếp trên chuỗi từ client, để
// tránh cho phép gọi bừa hàm nội bộ khác (kể cả hàm không phải api...).
//
// GHI CHÚ CORS: Apps Script không cho tùy chỉnh header CORS trên doPost, nhưng
// tự thêm "Access-Control-Allow-Origin: *" cho response dạng JSON (ContentService)
// khi request là "simple request" theo chuẩn fetch — tức là KHÔNG có header tùy
// chỉnh và Content-Type phải là 'text/plain;charset=utf-8' (không phải
// 'application/json', nếu không trình duyệt sẽ gửi preflight OPTIONS mà Apps
// Script không xử lý được và request sẽ bị chặn bởi CORS). Phía Index.html khi
// chuyển sang fetch() phải gửi đúng Content-Type này (xem hướng dẫn kèm theo).
const DANH_SACH_HAM_CHO_PHEP_ = {
  apiAdminLoginToken: apiAdminLoginToken,
  apiAdminLogout: apiAdminLogout,
  apiCheckSampleData: apiCheckSampleData,
  apiGetSystemInfo: apiGetSystemInfo,
  apiGetBootstrap: apiGetBootstrap,
  apiGetDonViList: apiGetDonViList,
  apiAddDonVi: apiAddDonVi,
  apiUpdateDonVi: apiUpdateDonVi,
  apiDeleteDonVi: apiDeleteDonVi,
  apiGetDonViTemplateCsv: apiGetDonViTemplateCsv,
  apiImportDonViCsv: apiImportDonViCsv,
  apiSearchCaNhan: apiSearchCaNhan,
  apiSearchDonVi: apiSearchDonVi,
  apiGetCaNhanList: apiGetCaNhanList,
  apiAddCaNhan: apiAddCaNhan,
  apiUpdateCaNhan: apiUpdateCaNhan,
  apiDeleteCaNhan: apiDeleteCaNhan,
  apiGetCaNhanTemplateCsv: apiGetCaNhanTemplateCsv,
  apiImportCaNhanCsv: apiImportCaNhanCsv,
  apiGetThanhTichCaNhan: apiGetThanhTichCaNhan,
  apiAddThanhTichCaNhan: apiAddThanhTichCaNhan,
  apiUpdateThanhTichCaNhan: apiUpdateThanhTichCaNhan,
  apiDeleteThanhTichCaNhan: apiDeleteThanhTichCaNhan,
  apiExportThanhTichCaNhanCsv: apiExportThanhTichCaNhanCsv,
  apiGetThanhTichCaNhanTemplateCsv: apiGetThanhTichCaNhanTemplateCsv,
  apiImportThanhTichCaNhanCsv: apiImportThanhTichCaNhanCsv,
  apiAddSangKien: apiAddSangKien,
  apiDeleteSangKien: apiDeleteSangKien,
  apiGetSangKienList: apiGetSangKienList,
  apiDanhDauDaDungSangKien: apiDanhDauDaDungSangKien,
  apiBoDanhDauSangKien: apiBoDanhDauSangKien,
  apiGetThanhTichTapThe: apiGetThanhTichTapThe,
  apiAddThanhTichTapThe: apiAddThanhTichTapThe,
  apiUpdateThanhTichTapThe: apiUpdateThanhTichTapThe,
  apiDeleteThanhTichTapThe: apiDeleteThanhTichTapThe,
  apiExportThanhTichTapTheCsv: apiExportThanhTichTapTheCsv,
  apiGetThanhTichTapTheTemplateCsv: apiGetThanhTichTapTheTemplateCsv,
  apiImportThanhTichTapTheCsv: apiImportThanhTichTapTheCsv,
  apiGetTienDoCaNhan: apiGetTienDoCaNhan,
  apiGetTienDoTapThe: apiGetTienDoTapThe,
  apiGetTongHopToanTruong: apiGetTongHopToanTruong,
  apiGenerateGiayChungNhan: apiGenerateGiayChungNhan
};

function doPost(e) {
  var ket_qua;
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error('Thiếu dữ liệu gửi lên (postData rỗng).');
    }
    const body = JSON.parse(e.postData.contents);
    const tenHam = body.fn;
    const thamSo = Array.isArray(body.args) ? body.args : [];

    const ham = DANH_SACH_HAM_CHO_PHEP_[tenHam];
    if (typeof ham !== 'function') {
      throw new Error('Yêu cầu không hợp lệ: không tìm thấy chức năng "' + tenHam + '".');
    }

    __REQUEST_ADMIN_TOKEN__ = body.adminToken || null;
    try {
      const data = ham.apply(null, thamSo);
      ket_qua = { ok: true, data: data };
    } finally {
      __REQUEST_ADMIN_TOKEN__ = null; // luôn dọn lại, tránh rò rỉ sang lần gọi khác
    }
  } catch (err) {
    ket_qua = { ok: false, error: String(err && err.message ? err.message : err) };
  }
  return ContentService.createTextOutput(JSON.stringify(ket_qua))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// 6. API — DANH MỤC ĐƠN VỊ
// ============================================================
function apiGetDonViList() {
  return readSheetAsObjects_(SHEET_DONVI);
}

function apiAddDonVi(data) {
  requireRole_(['Admin', 'TCCB']);
  const maDonVi = nextDonViCode_();
  appendRow_(SHEET_DONVI, { MaDonVi: maDonVi, TenDonVi: data.tenDonVi, LoaiHinh: data.loaiHinh, GhiChu: data.ghiChu || '' });
  logAction_('Thêm đơn vị', maDonVi + ' - ' + data.tenDonVi);
  return maDonVi;
}

function nextDonViCode_() {
  const existing = readSheetAsObjects_(SHEET_DONVI);
  const maxNum = existing.reduce(function (m, d) {
    var n = parseInt(String(d.MaDonVi).replace('DV', ''), 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 0);
  return 'DV' + String(maxNum + 1).padStart(2, '0');
}

function apiUpdateDonVi(maDonVi, patch) {
  requireRole_(['Admin', 'TCCB']);
  const ok = updateRowByKey_(SHEET_DONVI, 'MaDonVi', maDonVi, {
    TenDonVi: patch.tenDonVi, LoaiHinh: patch.loaiHinh, GhiChu: patch.ghiChu || ''
  });
  logAction_('Sửa đơn vị', maDonVi);
  return ok;
}

function apiDeleteDonVi(maDonVi) {
  requireRole_(['Admin', 'TCCB']);
  const donVi = readSheetAsObjects_(SHEET_DONVI).filter(function (d) { return d.MaDonVi === maDonVi; })[0];
  if (!donVi) throw new Error('Không tìm thấy đơn vị.');
  const soCaNhan = countRowsWhere_(SHEET_CANHAN, 'DonVi', donVi.TenDonVi);
  const soThanhTichTT = countRowsWhere_(SHEET_TT_TAPTHE, 'DonVi', donVi.TenDonVi);
  if (soCaNhan > 0 || soThanhTichTT > 0) {
    throw new Error('Không thể xóa: đơn vị đang có ' + soCaNhan + ' cá nhân và ' + soThanhTichTT +
      ' dòng thành tích tập thể liên kết. Hãy chuyển/xóa dữ liệu liên quan trước.');
  }
  const ok = deleteRowByKey_(SHEET_DONVI, 'MaDonVi', maDonVi);
  logAction_('Xóa đơn vị', maDonVi);
  return ok;
}

// --- Xuất file mẫu / Nhập CSV hàng loạt ---
function apiGetDonViTemplateCsv() {
  const header = ['TenDonVi', 'LoaiHinh', 'GhiChu'];
  const example = ['Bộ môn Dược lý', 'Bộ môn', 'Ví dụ - có thể xóa dòng này'];
  return toCsvRow_(header) + '\n' + toCsvRow_(example);
}

function apiImportDonViCsv(csvText) {
  requireRole_(['Admin', 'TCCB']);
  const rows = parseCsv_(csvText);
  if (rows.length < 2) throw new Error('File rỗng hoặc thiếu dữ liệu.');
  const header = rows[0].map(function (h) { return h.trim(); });
  const idxTen = header.indexOf('TenDonVi');
  const idxLoai = header.indexOf('LoaiHinh');
  const idxGhiChu = header.indexOf('GhiChu');
  if (idxTen === -1 || idxLoai === -1) throw new Error('File thiếu cột TenDonVi hoặc LoaiHinh. Hãy dùng đúng file mẫu.');

  var soThem = 0, loi = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    var ten = (r[idxTen] || '').trim();
    var loai = (r[idxLoai] || '').trim();
    if (!ten) continue;
    if (LOAI_HINH_VALID.indexOf(loai) === -1) {
      loi.push('Dòng ' + (i + 1) + ': Loại hình "' + loai + '" không hợp lệ (phải là Bộ môn/Phòng chức năng/Tập thể lớn).');
      continue;
    }
    var maDonVi = nextDonViCode_();
    appendRow_(SHEET_DONVI, { MaDonVi: maDonVi, TenDonVi: ten, LoaiHinh: loai, GhiChu: idxGhiChu !== -1 ? (r[idxGhiChu] || '') : '' });
    soThem++;
  }
  logAction_('Nhập CSV đơn vị', soThem + ' dòng, ' + loi.length + ' lỗi');
  return { soThem: soThem, loi: loi };
}

// ============================================================
// TRA CỨU CÔNG KHAI — không yêu cầu đăng nhập/phân quyền, dùng cho tab "Tìm kiếm"
// mở cho toàn thể người dùng. Chỉ trả về thông tin ở mức xem, không cho sửa/xóa.
// ============================================================
function apiSearchCaNhan(keyword) {
  const kw = String(keyword || '').trim().toLowerCase();
  if (!kw) return [];
  return readSheetAsObjects_(SHEET_CANHAN).filter(function (c) {
    return (c.HoTen && c.HoTen.toLowerCase().indexOf(kw) !== -1) ||
      (c.MaNV && c.MaNV.toLowerCase().indexOf(kw) !== -1) ||
      (c.DonVi && c.DonVi.toLowerCase().indexOf(kw) !== -1);
  }).slice(0, 30); // giới hạn 30 kết quả để tránh trả về quá nhiều
}

function apiSearchDonVi(keyword) {
  const kw = String(keyword || '').trim().toLowerCase();
  if (!kw) return [];
  return readSheetAsObjects_(SHEET_DONVI).filter(function (d) {
    return d.TenDonVi && d.TenDonVi.toLowerCase().indexOf(kw) !== -1;
  }).slice(0, 30);
}

// ============================================================
// 7. API — DANH SÁCH CÁ NHÂN
// ============================================================
function apiGetCaNhanList(donVi) {
  const list = readSheetAsObjects_(SHEET_CANHAN);
  var key = donVi ? String(donVi).trim() : donVi;
  return key ? list.filter(function (c) { return c.DonVi === key; }) : list;
}

function apiAddCaNhan(data) {
  requireRole_(ROLES_EDIT);
  const maNV = nextCaNhanCode_();
  appendRow_(SHEET_CANHAN, { MaNV: maNV, HoTen: data.hoTen, DonVi: data.donVi, ChucVu: data.chucVu || '', GhiChu: data.ghiChu || '' });
  logAction_('Thêm cá nhân', maNV + ' - ' + data.hoTen);
  return maNV;
}

function nextCaNhanCode_() {
  const existing = readSheetAsObjects_(SHEET_CANHAN);
  const maxNum = existing.reduce(function (m, c) {
    var n = parseInt(String(c.MaNV).replace('NV', ''), 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 0);
  return 'NV' + String(maxNum + 1).padStart(3, '0');
}

function apiUpdateCaNhan(maNV, patch) {
  requireRole_(ROLES_EDIT);
  // Chỉ cập nhật các trường thực sự có trên form sửa (HoTen/DonVi/ChucVu);
  // không đụng tới GhiChu để tránh vô tình xóa ghi chú đã có sẵn.
  const ok = updateRowByKey_(SHEET_CANHAN, 'MaNV', maNV, {
    HoTen: patch.hoTen, DonVi: patch.donVi, ChucVu: patch.chucVu || ''
  });
  logAction_('Sửa cá nhân', maNV);
  return ok;
}

function apiDeleteCaNhan(maNV) {
  requireRole_(ROLES_EDIT);
  const soThanhTich = countRowsWhere_(SHEET_TT_CANHAN, 'MaNV', maNV);
  if (soThanhTich > 0) {
    throw new Error('Không thể xóa: cá nhân đang có ' + soThanhTich + ' dòng thành tích. Hãy xóa thành tích liên quan trước.');
  }
  const ok = deleteRowByKey_(SHEET_CANHAN, 'MaNV', maNV);
  logAction_('Xóa cá nhân', maNV);
  return ok;
}

// --- Xuất file mẫu / Nhập CSV hàng loạt ---
function apiGetCaNhanTemplateCsv() {
  const header = ['HoTen', 'DonVi', 'ChucVu', 'GhiChu'];
  const example = ['Nguyễn Văn A', 'Bộ môn 1', 'Giảng viên', 'Ví dụ - có thể xóa dòng này (Đơn vị phải trùng đúng tên trong Danh mục đơn vị)'];
  return toCsvRow_(header) + '\n' + toCsvRow_(example);
}

function apiImportCaNhanCsv(csvText) {
  requireRole_(ROLES_EDIT);
  const rows = parseCsv_(csvText);
  if (rows.length < 2) throw new Error('File rỗng hoặc thiếu dữ liệu.');
  const header = rows[0].map(function (h) { return h.trim(); });
  const idxHoTen = header.indexOf('HoTen');
  const idxDonVi = header.indexOf('DonVi');
  const idxChucVu = header.indexOf('ChucVu');
  const idxGhiChu = header.indexOf('GhiChu');
  if (idxHoTen === -1 || idxDonVi === -1) throw new Error('File thiếu cột HoTen hoặc DonVi. Hãy dùng đúng file mẫu.');

  const donViHopLe = readSheetAsObjects_(SHEET_DONVI).map(function (d) { return d.TenDonVi; });
  var soThem = 0, loi = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    var hoTen = (r[idxHoTen] || '').trim();
    var donVi = (r[idxDonVi] || '').trim();
    if (!hoTen) continue;
    if (donViHopLe.indexOf(donVi) === -1) {
      loi.push('Dòng ' + (i + 1) + ': Đơn vị "' + donVi + '" chưa có trong Danh mục đơn vị.');
      continue;
    }
    var maNV = nextCaNhanCode_();
    appendRow_(SHEET_CANHAN, {
      MaNV: maNV, HoTen: hoTen, DonVi: donVi,
      ChucVu: idxChucVu !== -1 ? (r[idxChucVu] || '') : '',
      GhiChu: idxGhiChu !== -1 ? (r[idxGhiChu] || '') : ''
    });
    soThem++;
  }
  logAction_('Nhập CSV cá nhân', soThem + ' dòng, ' + loi.length + ' lỗi');
  return { soThem: soThem, loi: loi };
}

// ============================================================
// 8. API — THÀNH TÍCH CÁ NHÂN HÀNG NĂM
// ============================================================
function apiGetThanhTichCaNhan(maNV) {
  // QUAN TRỌNG: nếu maNV rỗng/không hợp lệ, PHẢI trả về mảng RỖNG — không được coi là "lấy tất cả",
  // tránh lộ dữ liệu của toàn bộ người khác khi 1 cá nhân bị thiếu Mã NV (ô trống trong sheet CaNhan).
  const key = maNV ? String(maNV).trim() : '';
  if (!key) return [];
  const list = readSheetAsObjects_(SHEET_TT_CANHAN);
  return list.filter(function (t) { return t.MaNV === key; });
}

function parseNamHoc_(input) {
  var m = String(input).match(/\d{4}/);
  return m ? Number(m[0]) : null;
}

function apiAddThanhTichCaNhan(data) {
  requireRole_(ROLES_EDIT);
  if (COMPLETION_LEVELS.indexOf(data.mucHoanThanh) === -1) throw new Error('Mức hoàn thành nhiệm vụ không hợp lệ.');
  if (DANHHIEU_CN.indexOf(data.danhHieuDat) === -1) throw new Error('Danh hiệu thi đua không hợp lệ.');
  const nam = parseNamHoc_(data.nam);
  if (!nam) throw new Error('Năm học không hợp lệ. Nhập dạng "2024" hoặc "2024-2025".');
  const user = getCurrentUser();
  const id = Utilities.getUuid();
  appendRow_(SHEET_TT_CANHAN, {
    ID: id, MaNV: data.maNV, Nam: nam, MucHoanThanh: data.mucHoanThanh, DanhHieuDat: data.danhHieuDat,
    TenSangKien: data.tenSangKien || '', PhamVi: data.phamVi || '', SoQD: data.soQD || '', GhiChu: data.ghiChu || '',
    NgayCapNhat: new Date(), NguoiCapNhat: user.email, NgayQD: data.ngayQD || '',
    NoiBanHanh: data.noiBanHanh || '', LinkMinhChung: data.linkMinhChung || ''
  });
  logAction_('Thêm thành tích cá nhân', data.maNV + ' - năm ' + nam);
  return id;
}

function apiUpdateThanhTichCaNhan(id, data) {
  requireRole_(ROLES_EDIT);
  if (COMPLETION_LEVELS.indexOf(data.mucHoanThanh) === -1) throw new Error('Mức hoàn thành nhiệm vụ không hợp lệ.');
  if (DANHHIEU_CN.indexOf(data.danhHieuDat) === -1) throw new Error('Danh hiệu thi đua không hợp lệ.');
  const nam = parseNamHoc_(data.nam);
  if (!nam) throw new Error('Năm học không hợp lệ. Nhập dạng "2024" hoặc "2024-2025".');
  const ok = updateRowByKey_(SHEET_TT_CANHAN, 'ID', id, {
    Nam: nam, MucHoanThanh: data.mucHoanThanh, DanhHieuDat: data.danhHieuDat,
    TenSangKien: data.tenSangKien || '', PhamVi: data.phamVi || '', SoQD: data.soQD || '',
    GhiChu: data.ghiChu || '', NgayQD: data.ngayQD || '', NoiBanHanh: data.noiBanHanh || '',
    LinkMinhChung: data.linkMinhChung || ''
  });
  logAction_('Sửa thành tích cá nhân', id);
  return ok;
}

function apiDeleteThanhTichCaNhan(id) {
  requireRole_(ROLES_EDIT);
  const ok = deleteRowByKey_(SHEET_TT_CANHAN, 'ID', id);
  logAction_('Xóa thành tích cá nhân', id);
  return ok;
}

// --- Xuất toàn bộ dữ liệu / Xuất file mẫu / Nhập CSV hàng loạt ---
const TTCN_CSV_HEADER = ['MaNV', 'HoTen', 'DonVi', 'Nam', 'MucHoanThanh', 'DanhHieuDat', 'TenSangKien', 'PhamVi', 'SoQD', 'NgayQD', 'NoiBanHanh', 'LinkMinhChung', 'GhiChu'];

function apiExportThanhTichCaNhanCsv() {
  requireRole_(ROLES_EDIT.concat(['HoiDong']));
  const caNhanMap = {};
  readSheetAsObjects_(SHEET_CANHAN).forEach(function (c) { caNhanMap[c.MaNV] = c; });
  const rows = [TTCN_CSV_HEADER];
  readSheetAsObjects_(SHEET_TT_CANHAN).forEach(function (t) {
    var c = caNhanMap[t.MaNV] || {};
    rows.push([
      t.MaNV, c.HoTen || '', c.DonVi || '', t.Nam, t.MucHoanThanh, t.DanhHieuDat,
      t.TenSangKien, t.PhamVi, t.SoQD, t.NgayQD, t.NoiBanHanh, t.LinkMinhChung, t.GhiChu
    ]);
  });
  return rows.map(toCsvRow_).join('\n');
}

function apiGetThanhTichCaNhanTemplateCsv() {
  const example = ['NV001', '(tự động - không cần điền, chỉ để tham khảo)', '(tự động)', '2024', 'Hoàn thành xuất sắc nhiệm vụ',
    'Chiến sĩ thi đua cơ sở', 'Đề tài nghiên cứu X', 'Cơ sở/Đơn vị', '123/QĐ-ĐHYD', '2024-12-20', 'Đại học Y Dược TP.HCM',
    'https://drive.google.com/...(link file scan QĐ)', ''];
  return toCsvRow_(TTCN_CSV_HEADER) + '\n' + toCsvRow_(example);
}

function apiImportThanhTichCaNhanCsv(csvText) {
  requireRole_(ROLES_EDIT);
  const rows = parseCsv_(csvText);
  if (rows.length < 2) throw new Error('File rỗng hoặc thiếu dữ liệu.');
  const header = rows[0].map(function (h) { return h.trim(); });
  const idx = {};
  TTCN_CSV_HEADER.forEach(function (h) { idx[h] = header.indexOf(h); });
  if (idx.MaNV === -1 || idx.Nam === -1 || idx.MucHoanThanh === -1 || idx.DanhHieuDat === -1) {
    throw new Error('File thiếu cột bắt buộc (MaNV, Nam, MucHoanThanh, DanhHieuDat). Hãy dùng đúng file mẫu.');
  }
  const maNVHopLe = readSheetAsObjects_(SHEET_CANHAN).map(function (c) { return c.MaNV; });
  const user = getCurrentUser();
  var soThem = 0, loi = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    var maNV = (r[idx.MaNV] || '').trim();
    if (!maNV) continue;
    var nam = parseNamHoc_(r[idx.Nam]);
    var muc = (r[idx.MucHoanThanh] || '').trim();
    var danhHieu = (r[idx.DanhHieuDat] || '').trim();
    if (maNVHopLe.indexOf(maNV) === -1) { loi.push('Dòng ' + (i + 1) + ': Mã NV "' + maNV + '" không tồn tại trong Danh sách cá nhân.'); continue; }
    if (!nam) { loi.push('Dòng ' + (i + 1) + ': Năm không hợp lệ.'); continue; }
    if (COMPLETION_LEVELS.indexOf(muc) === -1) { loi.push('Dòng ' + (i + 1) + ': Mức hoàn thành "' + muc + '" không hợp lệ.'); continue; }
    if (DANHHIEU_CN.indexOf(danhHieu) === -1) { loi.push('Dòng ' + (i + 1) + ': Danh hiệu "' + danhHieu + '" không hợp lệ.'); continue; }
    appendRow_(SHEET_TT_CANHAN, {
      ID: Utilities.getUuid(), MaNV: maNV, Nam: nam, MucHoanThanh: muc, DanhHieuDat: danhHieu,
      TenSangKien: idx.TenSangKien !== -1 ? (r[idx.TenSangKien] || '') : '',
      PhamVi: idx.PhamVi !== -1 ? (r[idx.PhamVi] || '') : '',
      SoQD: idx.SoQD !== -1 ? (r[idx.SoQD] || '') : '',
      GhiChu: idx.GhiChu !== -1 ? (r[idx.GhiChu] || '') : '',
      NgayCapNhat: new Date(), NguoiCapNhat: user.email,
      NgayQD: idx.NgayQD !== -1 ? (r[idx.NgayQD] || '') : '',
      NoiBanHanh: idx.NoiBanHanh !== -1 ? (r[idx.NoiBanHanh] || '') : '',
      LinkMinhChung: idx.LinkMinhChung !== -1 ? (r[idx.LinkMinhChung] || '') : ''
    });
    soThem++;
  }
  logAction_('Nhập CSV thành tích cá nhân', soThem + ' dòng, ' + loi.length + ' lỗi');
  return { soThem: soThem, loi: loi };
}

// ============================================================
// 8b. API — SÁNG KIẾN / ĐỀ TÀI (dùng làm căn cứ xét CSTĐ cơ sở, CSTĐ cấp Bộ...)
// ============================================================
function nextSangKienCode_() {
  const existing = readSheetAsObjects_(SHEET_SANGKIEN);
  const maxNum = existing.reduce(function (m, s) {
    var n = parseInt(String(s.MaSK).replace('SK', ''), 10);
    return isNaN(n) ? m : Math.max(m, n);
  }, 0);
  return 'SK' + String(maxNum + 1).padStart(3, '0');
}

// data: { tenSangKien, nam, phamVi, soQD, ngayQD, noiBanHanh, linkMinhChung, ghiChu,
//         thanhVien: [{ maNV, tyLeDongGop }, ...] }
function apiAddSangKien(data) {
  requireRole_(ROLES_EDIT);
  const nam = parseNamHoc_(data.nam);
  if (!nam) throw new Error('Năm không hợp lệ.');
  if (!data.tenSangKien) throw new Error('Chưa nhập tên sáng kiến/đề tài.');
  if (!data.thanhVien || data.thanhVien.length === 0) throw new Error('Cần ít nhất 1 người tham gia.');
  const maNVHopLe = readSheetAsObjects_(SHEET_CANHAN).map(function (c) { return c.MaNV; });
  data.thanhVien.forEach(function (tv) {
    if (maNVHopLe.indexOf(tv.maNV) === -1) throw new Error('Mã NV "' + tv.maNV + '" không tồn tại trong Danh sách cá nhân.');
  });

  const maSK = nextSangKienCode_();
  const user = getCurrentUser();
  appendRow_(SHEET_SANGKIEN, {
    MaSK: maSK, TenSangKien: data.tenSangKien, Nam: nam, PhamVi: data.phamVi || '',
    SoQD: data.soQD || '', NgayQD: data.ngayQD || '', NoiBanHanh: data.noiBanHanh || '',
    LinkMinhChung: data.linkMinhChung || '', GhiChu: data.ghiChu || '',
    NgayCapNhat: new Date(), NguoiCapNhat: user.email
  });
  data.thanhVien.forEach(function (tv) {
    appendRow_(SHEET_THANHVIEN_SANGKIEN, {
      ID: Utilities.getUuid(), MaSK: maSK, MaNV: tv.maNV, TyLeDongGop: tv.tyLeDongGop || '',
      DaDungXet: 'Không', DanhHieuDaXet: '', NamXet: '',
      NgayCapNhat: new Date(), NguoiCapNhat: user.email
    });
  });
  logAction_('Thêm sáng kiến', maSK + ' - ' + data.tenSangKien);
  return maSK;
}

function apiDeleteSangKien(maSK) {
  requireRole_(ROLES_EDIT);
  const thanhVien = readSheetAsObjects_(SHEET_THANHVIEN_SANGKIEN).filter(function (t) { return t.MaSK === maSK; });
  thanhVien.forEach(function (tv) { deleteRowByKey_(SHEET_THANHVIEN_SANGKIEN, 'ID', tv.ID); });
  const ok = deleteRowByKey_(SHEET_SANGKIEN, 'MaSK', maSK);
  logAction_('Xóa sáng kiến', maSK);
  return ok;
}

// Danh sách sáng kiến (kèm danh sách thành viên từng sáng kiến), lọc theo năm nếu có
function apiGetSangKienList(namLoc) {
  const sangKienList = readSheetAsObjects_(SHEET_SANGKIEN);
  const thanhVienList = readSheetAsObjects_(SHEET_THANHVIEN_SANGKIEN);
  const caNhanMap = {};
  readSheetAsObjects_(SHEET_CANHAN).forEach(function (c) { caNhanMap[c.MaNV] = c.HoTen; });

  var ds = sangKienList;
  if (namLoc) {
    var key = parseNamHoc_(namLoc);
    ds = ds.filter(function (s) { return Number(s.Nam) === key; });
  }
  return ds.map(function (s) {
    var thanhVien = thanhVienList.filter(function (t) { return t.MaSK === s.MaSK; })
      .map(function (t) { return { maNV: t.MaNV, hoTen: caNhanMap[t.MaNV] || '', tyLeDongGop: t.TyLeDongGop, daDungXet: t.DaDungXet, danhHieuDaXet: t.DanhHieuDaXet, namXet: t.NamXet }; });
    return {
      maSK: s.MaSK, tenSangKien: s.TenSangKien, nam: s.Nam, phamVi: s.PhamVi,
      soQD: s.SoQD, ngayQD: s.NgayQD, noiBanHanh: s.NoiBanHanh, linkMinhChung: s.LinkMinhChung, ghiChu: s.GhiChu,
      thanhVien: thanhVien
    };
  });
}

// Đánh dấu 1 người ĐÃ DÙNG phần đóng góp của họ trong 1 sáng kiến để xét 1 danh hiệu cụ thể —
// chỉ khóa lại phần của NGƯỜI ĐÓ, không ảnh hưởng người khác cùng tham gia sáng kiến này.
function apiDanhDauDaDungSangKien(maSK, maNV, danhHieu, namXet) {
  requireRole_(ROLES_EDIT);
  const thanhVienList = readSheetAsObjects_(SHEET_THANHVIEN_SANGKIEN);
  const dong = thanhVienList.filter(function (t) { return t.MaSK === maSK && t.MaNV === maNV; })[0];
  if (!dong) throw new Error('Không tìm thấy người này trong danh sách tham gia sáng kiến.');
  const ok = updateRowByKey_(SHEET_THANHVIEN_SANGKIEN, 'ID', dong.ID, {
    DaDungXet: 'Có', DanhHieuDaXet: danhHieu || '', NamXet: namXet || ''
  });
  logAction_('Đánh dấu đã dùng sáng kiến', maSK + ' - ' + maNV + ' - ' + danhHieu);
  return ok;
}

function apiBoDanhDauSangKien(maSK, maNV) {
  requireRole_(ROLES_EDIT);
  const thanhVienList = readSheetAsObjects_(SHEET_THANHVIEN_SANGKIEN);
  const dong = thanhVienList.filter(function (t) { return t.MaSK === maSK && t.MaNV === maNV; })[0];
  if (!dong) throw new Error('Không tìm thấy người này trong danh sách tham gia sáng kiến.');
  const ok = updateRowByKey_(SHEET_THANHVIEN_SANGKIEN, 'ID', dong.ID, { DaDungXet: 'Không', DanhHieuDaXet: '', NamXet: '' });
  logAction_('Bỏ đánh dấu đã dùng sáng kiến', maSK + ' - ' + maNV);
  return ok;
}

// ============================================================
// 9. API — THÀNH TÍCH TẬP THỂ HÀNG NĂM
// ============================================================
function apiGetThanhTichTapThe(donVi) {
  // Cùng nguyên tắc: đơn vị rỗng/không hợp lệ -> trả về RỖNG, không trả về toàn bộ dữ liệu mọi đơn vị.
  const key = donVi ? String(donVi).trim() : '';
  if (!key) return [];
  const list = readSheetAsObjects_(SHEET_TT_TAPTHE);
  return list.filter(function (t) { return t.DonVi === key; });
}

function apiAddThanhTichTapThe(data) {
  requireRole_(ROLES_EDIT);
  if (COMPLETION_LEVELS.indexOf(data.mucHoanThanh) === -1) throw new Error('Mức hoàn thành nhiệm vụ không hợp lệ.');
  if (DANHHIEU_TT.indexOf(data.danhHieuDat) === -1) throw new Error('Danh hiệu tập thể không hợp lệ.');
  const nam = parseNamHoc_(data.nam);
  if (!nam) throw new Error('Năm học không hợp lệ. Nhập dạng "2024" hoặc "2024-2025".');
  const user = getCurrentUser();
  const id = Utilities.getUuid();
  appendRow_(SHEET_TT_TAPTHE, {
    ID: id, DonVi: data.donVi, Nam: nam, MucHoanThanh: data.mucHoanThanh, KhongKyLuat: data.khongKyLuat || 'Có',
    DanhHieuDat: data.danhHieuDat, SoQD: data.soQD || '', GhiChu: data.ghiChu || '', NgayCapNhat: new Date(), NguoiCapNhat: user.email,
    NgayQD: data.ngayQD || '', NoiBanHanh: data.noiBanHanh || '', LinkMinhChung: data.linkMinhChung || ''
  });
  logAction_('Thêm thành tích tập thể', data.donVi + ' - năm ' + nam);
  return id;
}

function apiUpdateThanhTichTapThe(id, data) {
  requireRole_(ROLES_EDIT);
  if (COMPLETION_LEVELS.indexOf(data.mucHoanThanh) === -1) throw new Error('Mức hoàn thành nhiệm vụ không hợp lệ.');
  if (DANHHIEU_TT.indexOf(data.danhHieuDat) === -1) throw new Error('Danh hiệu tập thể không hợp lệ.');
  const nam = parseNamHoc_(data.nam);
  if (!nam) throw new Error('Năm học không hợp lệ. Nhập dạng "2024" hoặc "2024-2025".');
  const ok = updateRowByKey_(SHEET_TT_TAPTHE, 'ID', id, {
    Nam: nam, MucHoanThanh: data.mucHoanThanh, KhongKyLuat: data.khongKyLuat || 'Có',
    DanhHieuDat: data.danhHieuDat, SoQD: data.soQD || '', GhiChu: data.ghiChu || '',
    NgayQD: data.ngayQD || '', NoiBanHanh: data.noiBanHanh || '', LinkMinhChung: data.linkMinhChung || ''
  });
  logAction_('Sửa thành tích tập thể', id);
  return ok;
}

function apiDeleteThanhTichTapThe(id) {
  requireRole_(ROLES_EDIT);
  const ok = deleteRowByKey_(SHEET_TT_TAPTHE, 'ID', id);
  logAction_('Xóa thành tích tập thể', id);
  return ok;
}

// --- Xuất toàn bộ dữ liệu / Xuất file mẫu / Nhập CSV hàng loạt ---
const TTTT_CSV_HEADER = ['DonVi', 'Nam', 'MucHoanThanh', 'KhongKyLuat', 'DanhHieuDat', 'SoQD', 'NgayQD', 'NoiBanHanh', 'LinkMinhChung', 'GhiChu'];

function apiExportThanhTichTapTheCsv() {
  requireRole_(ROLES_EDIT.concat(['HoiDong']));
  const rows = [TTTT_CSV_HEADER];
  readSheetAsObjects_(SHEET_TT_TAPTHE).forEach(function (t) {
    rows.push([t.DonVi, t.Nam, t.MucHoanThanh, t.KhongKyLuat, t.DanhHieuDat, t.SoQD, t.NgayQD, t.NoiBanHanh, t.LinkMinhChung, t.GhiChu]);
  });
  return rows.map(toCsvRow_).join('\n');
}

function apiGetThanhTichTapTheTemplateCsv() {
  const example = ['Bộ môn 1', '2024', 'Hoàn thành xuất sắc nhiệm vụ', 'Có', 'Tập thể lao động xuất sắc', '456/QĐ-ĐHYD', '2024-12-20',
    'Đại học Y Dược TP.HCM', 'https://drive.google.com/...(link file scan QĐ)', ''];
  return toCsvRow_(TTTT_CSV_HEADER) + '\n' + toCsvRow_(example);
}

function apiImportThanhTichTapTheCsv(csvText) {
  requireRole_(ROLES_EDIT);
  const rows = parseCsv_(csvText);
  if (rows.length < 2) throw new Error('File rỗng hoặc thiếu dữ liệu.');
  const header = rows[0].map(function (h) { return h.trim(); });
  const idx = {};
  TTTT_CSV_HEADER.forEach(function (h) { idx[h] = header.indexOf(h); });
  if (idx.DonVi === -1 || idx.Nam === -1 || idx.MucHoanThanh === -1 || idx.DanhHieuDat === -1) {
    throw new Error('File thiếu cột bắt buộc (DonVi, Nam, MucHoanThanh, DanhHieuDat). Hãy dùng đúng file mẫu.');
  }
  const donViHopLe = readSheetAsObjects_(SHEET_DONVI).map(function (d) { return d.TenDonVi; });
  const user = getCurrentUser();
  var soThem = 0, loi = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    var donVi = (r[idx.DonVi] || '').trim();
    if (!donVi) continue;
    var nam = parseNamHoc_(r[idx.Nam]);
    var muc = (r[idx.MucHoanThanh] || '').trim();
    var danhHieu = (r[idx.DanhHieuDat] || '').trim();
    var khongKyLuat = idx.KhongKyLuat !== -1 ? (r[idx.KhongKyLuat] || 'Có').trim() : 'Có';
    if (donViHopLe.indexOf(donVi) === -1) { loi.push('Dòng ' + (i + 1) + ': Đơn vị "' + donVi + '" không có trong Danh mục đơn vị.'); continue; }
    if (!nam) { loi.push('Dòng ' + (i + 1) + ': Năm không hợp lệ.'); continue; }
    if (COMPLETION_LEVELS.indexOf(muc) === -1) { loi.push('Dòng ' + (i + 1) + ': Mức hoàn thành "' + muc + '" không hợp lệ.'); continue; }
    if (DANHHIEU_TT.indexOf(danhHieu) === -1) { loi.push('Dòng ' + (i + 1) + ': Danh hiệu "' + danhHieu + '" không hợp lệ.'); continue; }
    appendRow_(SHEET_TT_TAPTHE, {
      ID: Utilities.getUuid(), DonVi: donVi, Nam: nam, MucHoanThanh: muc, KhongKyLuat: khongKyLuat, DanhHieuDat: danhHieu,
      SoQD: idx.SoQD !== -1 ? (r[idx.SoQD] || '') : '',
      GhiChu: idx.GhiChu !== -1 ? (r[idx.GhiChu] || '') : '',
      NgayCapNhat: new Date(), NguoiCapNhat: user.email,
      NgayQD: idx.NgayQD !== -1 ? (r[idx.NgayQD] || '') : '',
      NoiBanHanh: idx.NoiBanHanh !== -1 ? (r[idx.NoiBanHanh] || '') : '',
      LinkMinhChung: idx.LinkMinhChung !== -1 ? (r[idx.LinkMinhChung] || '') : ''
    });
    soThem++;
  }
  logAction_('Nhập CSV thành tích tập thể', soThem + ' dòng, ' + loi.length + ' lỗi');
  return { soThem: soThem, loi: loi };
}

// ============================================================
// 10. API — TỔNG HỢP / DASHBOARD (dùng RuleEngine.gs)
// ============================================================
function apiGetTienDoCaNhan(maNV) {
  return tinhTienDoCaNhan_(maNV ? String(maNV).trim() : maNV);
}

function apiGetTienDoTapThe(donVi) {
  return tinhTienDoTapThe_(donVi ? String(donVi).trim() : donVi);
}

function apiGetTongHopToanTruong() {
  requireRole_(ROLES_VIEW_ALL);
  // TỐI ƯU HIỆU NĂNG: đọc mỗi sheet ĐÚNG 1 LẦN, sau đó tính toán hoàn toàn trong bộ nhớ cho
  // TỪNG người/đơn vị bằng các hàm thuần (...TuDuLieu_) — tránh gọi lại readSheetAsObjects_
  // hàng trăm lần (mỗi người/đơn vị 1 lần) như cách làm cũ, vốn khiến trang tải rất chậm khi
  // số lượng người/đơn vị lớn.
  const caNhan = readSheetAsObjects_(SHEET_CANHAN);
  const donViList = readSheetAsObjects_(SHEET_DONVI);
  const thanhTichCaNhanList = readSheetAsObjects_(SHEET_TT_CANHAN);
  const thanhTichTapTheList = readSheetAsObjects_(SHEET_TT_TAPTHE);
  const sangKienList = readSheetAsObjects_(SHEET_SANGKIEN);
  const thanhVienSangKienList = readSheetAsObjects_(SHEET_THANHVIEN_SANGKIEN);

  const tienDoCaNhan = caNhan.map(function (c) {
    return tinhTienDoCaNhanTuDuLieu_(c.MaNV, caNhan, thanhTichCaNhanList, sangKienList, thanhVienSangKienList);
  });
  const tienDoTapThe = donViList.map(function (d) {
    return tinhTienDoTapTheTuDuLieu_(d.TenDonVi, donViList, caNhan, thanhTichCaNhanList, thanhTichTapTheList);
  });
  return { caNhan: caNhan, tienDoCaNhan: tienDoCaNhan, donVi: donViList, tienDoTapThe: tienDoTapThe };
}

// ============================================================
// 11. API — SINH VĂN BẢN ĐƠN GIẢN (Google Docs)
// ============================================================
function apiGenerateGiayChungNhan(maNV) {
  requireRole_(['Admin', 'TCCB']);
  const caNhan = readSheetAsObjects_(SHEET_CANHAN).filter(function (c) { return c.MaNV === maNV; })[0];
  if (!caNhan) throw new Error('Không tìm thấy cá nhân.');
  const tienDo = tinhTienDoCaNhan_(maNV);

  const doc = DocumentApp.create('GiayChungNhan_' + maNV + '_' + new Date().getTime());
  const body = doc.getBody();
  body.setMarginTop(56).setMarginBottom(56).setMarginLeft(72).setMarginRight(72);
  body.appendParagraph('ĐẠI HỌC Y DƯỢC THÀNH PHỐ HỒ CHÍ MINH')
    .setHeading(DocumentApp.ParagraphHeading.HEADING2).setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  body.appendParagraph('GIẤY CHỨNG NHẬN')
    .setHeading(DocumentApp.ParagraphHeading.TITLE).setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  body.appendParagraph('Căn cứ Quy chế Thi đua khen thưởng ban hành kèm Nghị quyết số 45/NQ-HĐT ngày 18/6/2025 của Hội đồng trường ĐHYD TP.HCM,');
  body.appendParagraph('');
  body.appendParagraph('Chứng nhận: ' + caNhan.HoTen).setBold(true);
  body.appendParagraph('Đơn vị công tác: ' + caNhan.DonVi);
  body.appendParagraph('Chức vụ: ' + (caNhan.ChucVu || ''));
  body.appendParagraph('');
  body.appendParagraph('Tổng số lần đạt danh hiệu Chiến sĩ thi đua cơ sở: ' + tienDo.tongSoLanCSTD);
  body.appendParagraph('Số năm liên tục hoàn thành tốt nhiệm vụ trở lên (tính đến năm gần nhất có dữ liệu): ' + tienDo.streakHTTNV);
  body.appendParagraph('');
  body.appendParagraph('Ngày xuất: ' + Utilities.formatDate(new Date(), 'GMT+7', 'dd/MM/yyyy'));
  doc.saveAndClose();

  logAction_('Sinh Giấy chứng nhận', maNV);
  return doc.getUrl();
}
