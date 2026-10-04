/* Apps Script HTML bridge: authenticated data never travels in query strings. */
const BackendClient = (() => {
    const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwC2pfzd112NVPlbjWoNB19riVKXA3ccWr774NSpsehKnXuJFHCRB81MvDaC-GlxBIESA/exec';
    let bridge = null;
    let readyPromise = null;
    const pending = new Map();

    function requestId() {
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
    }

    function connect() {
        if (readyPromise) return readyPromise;
        readyPromise = new Promise((resolve, reject) => {
            const channel = requestId();
            const frame = document.createElement('iframe');
            frame.hidden = true;
            frame.title = 'Kết nối phản hồi';
            frame.referrerPolicy = 'no-referrer';
            const url = new URL(SCRIPT_URL);
            url.searchParams.set('action', 'bridge');
            url.searchParams.set('origin', location.origin);
            url.searchParams.set('channel', channel);
            const timeout = setTimeout(() => {
                window.removeEventListener('message', receive);
                frame.remove();
                readyPromise = null;
                reject(new Error('Chưa kết nối được máy chủ. Kiểm tra mạng hoặc cập nhật bản triển khai Apps Script.'));
            }, 20000);
            function receive(event) {
                const msg = event.data;
                if (!/^https:\/\/(?:[a-z0-9-]+-script|script|[a-z0-9-]+\.script)\.googleusercontent\.com$/.test(event.origin)
                    && event.origin !== 'https://script.google.com') return;
                if (!msg || msg.type !== 'meow-backend' || msg.channel !== channel || !event.source) return;
                if (msg.ready && !bridge) {
                    bridge = { source: event.source, origin: event.origin, channel };
                    clearTimeout(timeout);
                    resolve();
                } else if (bridge && event.source === bridge.source && event.origin === bridge.origin) {
                    const call = pending.get(msg.id);
                    if (!call) return;
                    pending.delete(msg.id);
                    clearTimeout(call.timeout);
                    if (msg.result && msg.result.success === true) call.resolve(msg.result);
                    else {
                        const error = new Error(msg.result?.error || 'Máy chủ không xác nhận thành công.');
                        error.code = msg.result?.code || 'SERVER_ERROR';
                        call.reject(error);
                    }
                }
            }
            window.addEventListener('message', receive);
            frame.src = url.href;
            document.body.appendChild(frame);
        });
        return readyPromise;
    }

    async function request(action, payload = {}) {
        if (!navigator.onLine) throw new Error('Đang offline. Kết nối mạng rồi gửi lại; nội dung vẫn được giữ lại.');
        await connect();
        const id = requestId();
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                pending.delete(id);
                const error = new Error('Chưa nhận được xác nhận. Nội dung vẫn được giữ lại; bấm gửi lại để kiểm tra cùng yêu cầu.');
                error.code = 'UNCONFIRMED';
                reject(error);
            }, 60000);
            pending.set(id, { resolve, reject, timeout });
            bridge.source.postMessage({ type: 'meow-request', channel: bridge.channel, id, payload: { ...payload, action } }, bridge.origin);
        });
    }
    return { request, requestId };
})();
