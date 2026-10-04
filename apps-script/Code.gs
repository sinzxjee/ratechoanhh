/**
 * Deploy together with Bridge.html. Set ADMIN_KEY in Script Properties first.
 * Run setupBackend_ in the editor to authorize Sheets, Drive and Mail.
 * Update the EXISTING Web app deployment to a new version to keep its /exec URL.
 */
const SPREADSHEET_ID = '19VMyZMlWPwnt69FDE1ujU1YzBoycpeHreWCEl3qAuz0';
const SHEET_NAME = 'Feedback';
const HEADERS = ['Timestamp', 'Email', 'Service', 'Stars', 'Comment', 'PhotoURL', 'Replied', 'ReplyMessage', 'RequestID', 'ReplyRequestID'];

function doGet(e) {
    try {
        const p = e && e.parameter || {};
        if (p.action !== 'bridge') return jsonResponse_({ success: false, error: 'Mở ứng dụng để gửi hoặc xem feedback.' });
        const allowed = (PropertiesService.getScriptProperties().getProperty('ALLOWED_ORIGINS') || 'https://sinzxjee.github.io')
            .split(',').map(function(origin) { return origin.trim(); });
        if (allowed.indexOf(p.origin) < 0 || !/^[a-f0-9]{32}$/.test(p.channel || '')) {
            return HtmlService.createHtmlOutput('Nguồn ứng dụng chưa được cho phép. Kiểm tra ALLOWED_ORIGINS.');
        }
        const template = HtmlService.createTemplateFromFile('Bridge');
        template.config = JSON.stringify({ origin: p.origin, channel: p.channel }).replace(/</g, '\\u003c');
        return template.evaluate().setTitle('Meow Feedback Backend')
            .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    } catch (err) {
        return jsonResponse_({ success: false, error: err.message });
    }
}

// Keep POST clients compatible; the new UI uses google.script.run through Bridge.
function doPost(e) {
    try { return jsonResponse_(handleClientRequest(JSON.parse(e.postData.contents))); }
    catch (err) { return jsonResponse_({ success: false, error: err.message }); }
}

function handleClientRequest(data) {
    try {
        if (!data || typeof data !== 'object') throw new Error('Dữ liệu không hợp lệ.');
        switch (data.action) {
            case 'submit': return handleSubmit_(data);
            case 'list': requireAdmin_(data.key); return handleList_();
            case 'reply': requireAdmin_(data.key); return handleReply_(data);
            default: throw new Error('Thao tác không hợp lệ.');
        }
    } catch (err) {
        return { success: false, error: err.message, code: err.code || 'SERVER_ERROR' };
    }
}

function requireAdmin_(key) {
    const expected = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
    if (!expected) throw new Error('Chưa cấu hình ADMIN_KEY trong Script Properties.');
    if (!key || key !== expected) {
        const err = new Error('Sai mật khẩu admin.');
        err.code = 'AUTH';
        throw err;
    }
}

function getSheet_() {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
    if (sheet.getLastRow() === 0) sheet.appendRow(HEADERS);
    const headers = sheet.getRange(1, 1, 1, 8).getValues()[0];
    if (HEADERS.slice(0, 8).some(function(h, i) { return headers[i] !== h; })) {
        throw new Error('Tab Feedback có cấu trúc cột khác dự kiến. Kiểm tra tiêu đề A1:H1 trước khi ghi.');
    }
    if (sheet.getMaxColumns() < 10) sheet.insertColumnsAfter(sheet.getMaxColumns(), 10 - sheet.getMaxColumns());
    const ids = sheet.getRange(1, 9, 1, 2).getValues()[0];
    if ((ids[0] && ids[0] !== HEADERS[8]) || (ids[1] && ids[1] !== HEADERS[9])) {
        throw new Error('Cột I/J đang chứa dữ liệu khác; cần dành hai cột cho RequestID và ReplyRequestID.');
    }
    sheet.getRange(1, 9, 1, 2).setValues([HEADERS.slice(8)]);
    return sheet;
}

function text_(value, limit, name) {
    if (typeof value !== 'string') throw new Error('Thiếu ' + name + '.');
    const text = value.trim();
    if (!text || text.length > limit) throw new Error(name + ' không hợp lệ (tối đa ' + limit + ' ký tự).');
    return text;
}

function validEmail_(value) {
    const email = text_(value, 254, 'email');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Email không hợp lệ.');
    return email;
}

function validRequestId_(value) {
    if (!/^[a-f0-9]{32}$/.test(value || '')) throw new Error('Thiếu mã yêu cầu. Cập nhật giao diện rồi gửi lại.');
    return value;
}

function safeCell_(value) {
    // appendRow treats leading '=' as a formula; store user input as literal text.
    return /^[=+@-]/.test(value) ? "'" + value : value;
}

function findId_(sheet, column, id) {
    if (sheet.getLastRow() < 2) return null;
    return sheet.getRange(2, column, sheet.getLastRow() - 1, 1).createTextFinder(id).matchEntireCell(true).findNext();
}

function handleSubmit_(data) {
    const requestId = validRequestId_(data.requestId);
    const email = validEmail_(data.email);
    const service = text_(data.service, 200, 'tên dịch vụ');
    const comment = text_(data.comment, 5000, 'nhận xét');
    const stars = Number(data.stars);
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw new Error('Số sao phải từ 1 đến 5.');
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
        const sheet = getSheet_();
        if (findId_(sheet, 9, requestId)) return { success: true, requestId, duplicate: true };
        let photoUrl = '';
        let photoWarning = '';
        if (data.photoBase64) {
            if (data.photoMime !== 'image/jpeg' || typeof data.photoBase64 !== 'string'
                || data.photoBase64.length > 3000000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(data.photoBase64)) {
                throw new Error('Ảnh không hợp lệ hoặc quá lớn.');
            }
            const folders = DriveApp.getFoldersByName('MeowFeedback_Photos');
            const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder('MeowFeedback_Photos');
            const bytes = Utilities.base64Decode(data.photoBase64);
            const file = folder.createFile(Utilities.newBlob(bytes, 'image/jpeg', 'feedback_' + requestId + '.jpg'));
            // Keep uploaded photos private; no automatic public sharing.
            photoUrl = file.getUrl();
            photoWarning = 'Ảnh đã lưu riêng tư trong Drive; admin mở bằng tài khoản sở hữu.';
        }
        sheet.appendRow([new Date(), email, safeCell_(service), stars, safeCell_(comment), photoUrl, 'No', '', requestId, '']);
        SpreadsheetApp.flush();
        return { success: true, requestId, warning: photoWarning };
    } finally { lock.releaseLock(); }
}

function handleList_() {
    const values = getSheet_().getDataRange().getValues();
    const rows = values.slice(1).map(function(r, i) {
        return {
            rowIndex: i + 2, timestamp: r[0] instanceof Date ? r[0].toISOString() : String(r[0] || ''),
            email: String(r[1] || ''), service: String(r[2] || ''), stars: Number(r[3]) || 0,
            comment: String(r[4] || ''), photoUrl: String(r[5] || ''), replied: String(r[6] || ''),
            replyMessage: String(r[7] || ''), feedbackId: String(r[8] || '')
        };
    }).filter(function(r) { return r.email || r.service || r.comment; });
    return { success: true, data: rows.reverse() };
}

function handleReply_(data) {
    const requestId = validRequestId_(data.requestId);
    const message = text_(data.message, 10000, 'nội dung trả lời');
    const subject = data.subject ? text_(data.subject, 200, 'tiêu đề') : 'Cảm ơn em vì feedback ❤️';
    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
        const sheet = getSheet_();
        const prior = findId_(sheet, 10, requestId);
        if (prior) {
            const state = sheet.getRange(prior.getRow(), 7).getValue();
            if (state === 'Yes') return { success: true, duplicate: true };
            throw new Error('Yêu cầu gửi email này đang xử lý hoặc chưa xác nhận. Kiểm tra thư đã gửi trước khi thử lại.');
        }
        let rowIndex = Number(data.rowIndex);
        if (data.feedbackId) {
            const found = findId_(sheet, 9, data.feedbackId);
            if (!found) throw new Error('Feedback không còn tồn tại. Làm mới danh sách.');
            rowIndex = found.getRow();
        }
        if (!Number.isInteger(rowIndex) || rowIndex < 2 || rowIndex > sheet.getLastRow()) throw new Error('Dòng feedback không hợp lệ.');
        const old = sheet.getRange(rowIndex, 1, 1, 10).getValues()[0];
        const recipient = validEmail_(String(old[1] || ''));
        if (data.to && data.to !== recipient) throw new Error('Email của dòng đã thay đổi. Làm mới danh sách rồi gửi lại.');
        if (old[6] === 'Sending') throw new Error('Dòng này đang chờ xác nhận gửi email. Kiểm tra thư đã gửi trước khi gửi tiếp.');
        if (MailApp.getRemainingDailyQuota() < 1) throw new Error('Tài khoản Google đã hết hạn mức gửi email hôm nay.');
        sheet.getRange(rowIndex, 7).setValue('Sending');
        sheet.getRange(rowIndex, 10).setValue(requestId);
        SpreadsheetApp.flush();
        try {
            MailApp.sendEmail({ to: recipient, subject, body: message, name: 'Meow Feedback' });
        } catch (err) {
            sheet.getRange(rowIndex, 7).setValue(old[6] || 'No');
            sheet.getRange(rowIndex, 10).setValue(old[9] || '');
            throw new Error('Google chưa gửi được email: ' + err.message);
        }
        try {
            sheet.getRange(rowIndex, 7).setValue('Yes');
            sheet.getRange(rowIndex, 8).setValue(safeCell_(message));
            SpreadsheetApp.flush();
        } catch (err) {
            return { success: true, warning: 'Google đã nhận lệnh gửi email nhưng chưa cập nhật được trạng thái Sheet. Kiểm tra thư đã gửi; không gửi lại.' };
        }
        return { success: true };
    } finally { lock.releaseLock(); }
}

function setupBackend_() {
    if (!PropertiesService.getScriptProperties().getProperty('ADMIN_KEY')) throw new Error('Cần đặt ADMIN_KEY trong Script Properties trước.');
    getSheet_();
    DriveApp.getRootFolder().getId();
    const quota = MailApp.getRemainingDailyQuota();
    console.log('Backend sẵn sàng. Hạn mức email còn lại: ' + quota);
}

function jsonResponse_(obj) {
    return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
