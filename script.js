// ⚠️ Dùng CHUNG 1 URL Apps Script cho cả form feedback và admin panel
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzlcWb7LonMbd0hjqVVNZKbdXgKrMUBQczFeDexZQDjPWDCBrkDYA7JhhbM7xjlyf5EIA/exec";

document.addEventListener('DOMContentLoaded', () => {
    const feedbackView = document.getElementById('feedback-view');
    const adminView = document.getElementById('admin-view');

    initCursorFollower();
    initPawPrints();
    initServiceWorker();
    const gamification = initGamification();
    initFeedbackForm(gamification);
    initAdminPanel();
    initViewSwitcher();

    // ===================================================================
    // PWA: đăng ký service worker (cài app + dùng offline)
    // ===================================================================
    function initServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('sw.js').catch((err) => {
                    console.warn('Không đăng ký được service worker:', err);
                });
            });
        }
    }

    // ===================================================================
    // 🏅 GAMIFICATION: huy hiệu, streak, lịch sử đánh giá (lưu ở máy này)
    // ===================================================================
    function initGamification() {
        const HISTORY_KEY = 'ratechotui_history';
        const MAX_HISTORY = 50;

        const TIERS = [
            { min: 0,  emoji: '🐣', title: 'Tân binh' },
            { min: 5,  emoji: '😺', title: 'Quen mặt' },
            { min: 10, emoji: '😻', title: 'Thân thiết' },
            { min: 20, emoji: '👑', title: 'Huyền thoại' },
            { min: 50, emoji: '🏆', title: 'Bậc thầy' }
        ];

        const badgeEmoji = document.getElementById('badge-emoji');
        const badgeTitle = document.getElementById('badge-title');
        const badgeSub = document.getElementById('badge-sub');
        const streakChip = document.getElementById('streak-chip');
        const progressFill = document.getElementById('progress-fill');
        const toggleHistoryBtn = document.getElementById('toggle-history-btn');
        const historyList = document.getElementById('history-list');

        if (!badgeEmoji) return { recordSubmission: () => {} }; // an toàn nếu HTML thiếu panel

        function loadHistory() {
            try {
                return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
            } catch (e) {
                return [];
            }
        }

        function saveHistory(history) {
            localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
        }

        function getTierIndex(count) {
            let idx = 0;
            for (let i = 0; i < TIERS.length; i++) {
                if (count >= TIERS[i].min) idx = i;
            }
            return idx;
        }

        function calcStreak(history) {
            if (history.length === 0) return 0;
            const dayKeys = new Set(history.map((h) => new Date(h.ts).toDateString()));
            let streak = 0;
            const cursor = new Date();
            cursor.setHours(0, 0, 0, 0);

            // Nếu hôm nay chưa có feedback thì bắt đầu đếm từ hôm qua
            if (!dayKeys.has(cursor.toDateString())) {
                cursor.setDate(cursor.getDate() - 1);
            }

            while (dayKeys.has(cursor.toDateString())) {
                streak++;
                cursor.setDate(cursor.getDate() - 1);
            }
            return streak;
        }

        function renderBadge(history) {
            const count = history.length;
            const tierIdx = getTierIndex(count);
            const tier = TIERS[tierIdx];
            const next = TIERS[tierIdx + 1];

            badgeEmoji.innerText = tier.emoji;
            badgeTitle.innerText = tier.title;
            badgeSub.innerText = next
                ? `${count}/${next.min} lần đánh giá`
                : `${count} lần đánh giá - Cấp tối đa! 🎉`;

            const percent = next
                ? Math.min(100, ((count - tier.min) / (next.min - tier.min)) * 100)
                : 100;
            progressFill.style.width = percent + '%';

            const streak = calcStreak(history);
            if (streak >= 2) {
                streakChip.innerText = `🔥 Streak ${streak} ngày`;
                streakChip.classList.add('show');
            } else {
                streakChip.classList.remove('show');
            }

            return tierIdx;
        }

        function renderHistory(history) {
            historyList.innerHTML = '';
            if (history.length === 0) {
                historyList.innerHTML = '<p class="history-empty">Chưa có lần đánh giá nào cả 🐾</p>';
                return;
            }
            history.slice(0, 8).forEach((h) => {
                const row = document.createElement('div');
                row.className = 'history-item';
                const d = new Date(h.ts);
                row.innerHTML = `
                    <span class="history-stars">${'★'.repeat(h.stars)}${'☆'.repeat(5 - h.stars)}</span>
                    <span>${escapeHtml(h.service || '')}</span>
                    <span>${d.toLocaleDateString('vi-VN')}</span>
                `;
                historyList.appendChild(row);
            });
        }

        function escapeHtml(str) {
            const div = document.createElement('div');
            div.innerText = str;
            return div.innerHTML;
        }

        function showBadgeToast(tier) {
            const toast = document.createElement('div');
            toast.className = 'badge-toast';
            toast.innerText = `🎉 Mở khóa huy hiệu mới: ${tier.emoji} ${tier.title}!`;
            document.body.appendChild(toast);
            requestAnimationFrame(() => toast.classList.add('show'));
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => toast.remove(), 400);
            }, 2500);
        }

        toggleHistoryBtn.addEventListener('click', () => {
            const isHidden = historyList.classList.toggle('hidden');
            toggleHistoryBtn.innerText = isHidden ? 'Xem lịch sử đánh giá ▾' : 'Ẩn lịch sử đánh giá ▴';
        });

        // Render lần đầu khi load trang
        let history = loadHistory();
        renderBadge(history);
        renderHistory(history);

        function recordSubmission(entry) {
            const before = loadHistory();
            const tierBefore = getTierIndex(before.length);

            const updated = [{ ts: Date.now(), ...entry }, ...before];
            saveHistory(updated);

            const tierIdx = renderBadge(updated);
            renderHistory(updated);

            if (tierIdx > tierBefore) {
                showBadgeToast(TIERS[tierIdx]);
            }
        }

        return { recordSubmission };
    }

    // ===================================================================
    // ĐIỀU HƯỚNG GIỮA 2 VIEW (form feedback <-> admin)
    // ===================================================================
    function initViewSwitcher() {
        const mascot = document.getElementById('cat-mascot');
        const backToFormBtn = document.getElementById('back-to-form-btn');

        function showAdmin() {
            feedbackView.classList.add('hidden');
            adminView.classList.remove('hidden');
        }

        function showFeedback() {
            adminView.classList.add('hidden');
            feedbackView.classList.remove('hidden');
        }

        // Cách 1: mở link kèm ?admin=1
        const params = new URLSearchParams(window.location.search);
        if (params.get('admin') === '1') {
            showAdmin();
        }

        // Cách 2: bấm liên tục vào mascot 7 lần trong 2 giây (easter egg)
        if (mascot) {
            let clickCount = 0;
            let clickTimer = null;
            mascot.addEventListener('click', () => {
                clickCount++;
                clearTimeout(clickTimer);
                clickTimer = setTimeout(() => { clickCount = 0; }, 2000);
                if (clickCount >= 7) {
                    clickCount = 0;
                    showAdmin();
                }
            });
        }

        if (backToFormBtn) {
            backToFormBtn.addEventListener('click', showFeedback);
        }
    }

    // ===================================================================
    // HIỆU ỨNG CHUNG: mèo theo chuột + dấu chân khi click
    // ===================================================================
    function initCursorFollower() {
        const follower = document.getElementById('cursor-follower');
        if (!follower) return;
        follower.innerHTML = `<img src="https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExNHJueGZ3bm9ueXpueHByZzJueGZ3bm9ueXpueHByZzJueGZ3bm9ueSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9cw/3oriO0OEd9QIDdllqo/giphy.gif" style="width:50px; height:50px; object-fit:contain;">`;
        document.addEventListener('mousemove', (e) => {
            follower.style.left = e.clientX - 25 + 'px';
            follower.style.top = e.clientY - 25 + 'px';
        });
    }

    function initPawPrints() {
        document.addEventListener('click', (e) => {
            if (['BUTTON', 'INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
            const paw = document.createElement('div');
            paw.className = 'paw-print';
            paw.innerText = '🐾';
            paw.style.left = (e.pageX - 15) + 'px';
            paw.style.top = (e.pageY - 15) + 'px';
            paw.style.transform = `rotate(${Math.random() * 360}deg)`;
            document.body.appendChild(paw);
            setTimeout(() => paw.remove(), 1000);
        });
    }

    function makeItRain() {
        const icons = ['🐱', '🐈', '🐾', '🐟', '👑', '❤️'];
        for (let i = 0; i < 30; i++) {
            setTimeout(() => {
                const drop = document.createElement('div');
                drop.className = 'cat-drop';
                drop.innerText = icons[Math.floor(Math.random() * icons.length)];
                drop.style.left = Math.random() * 90 + 'vw';
                drop.style.animationDuration = (Math.random() * 1.5 + 1) + 's';
                document.body.appendChild(drop);
                setTimeout(() => drop.remove(), 2500);
            }, i * 80);
        }
    }

    // ===================================================================
    // VIEW 1: FORM FEEDBACK
    // ===================================================================
    function initFeedbackForm(gamification) {
        let rating = 0;
        let photoBase64 = "";
        let photoMime = "";

        const mascot = document.getElementById('cat-mascot');
        const bubble = document.getElementById('chat-bubble');
        const thanksPopup = document.getElementById('thanks-popup');
        const closePopup = document.getElementById('close-popup');
        const emailInput = document.getElementById('user-email');
        const emailError = document.getElementById('email-error');
        const photoInput = document.getElementById('photo-input');
        const photoPreviewWrap = document.getElementById('photo-preview-wrap');
        const photoPreview = document.getElementById('photo-preview');
        const removePhotoBtn = document.getElementById('remove-photo');
        const downloadCardBtn = document.getElementById('download-card-btn');
        const sendBtn = document.getElementById('send-btn');
        const stars = document.querySelectorAll('#stars span');

        const catEmotions = {
            1: { img: "https://cataas.com/cat/angry", msg: "Tệ quá không zay 😿", color: "#ff4d4d" },
            2: { img: "https://cataas.com/cat/sad", msg: "Cố gắng lên 1 xíu nữa xemm 😿", color: "#ff944d" },
            3: { img: "https://cataas.com/cat/cute", msg: "Chắc là cũng ổn thui 😸", color: "#ffd11a" },
            4: { img: "https://cataas.com/cat/says/Great", msg: "Thật sự đỉnh 😻", color: "#54a0ff" },
            5: { img: "https://cataas.com/cat/says/Perfect", msg: "Quá là tuyệt với lun ròii 👑", color: "#ff80ab" }
        };

        stars.forEach(s => {
            s.addEventListener('click', () => {
                rating = parseInt(s.dataset.v);
                stars.forEach(star => star.classList.toggle('active', star.dataset.v <= rating));
                const emotion = catEmotions[rating];
                mascot.src = `${emotion.img}?t=${Date.now()}`;
                bubble.innerText = emotion.msg;
                bubble.style.borderColor = emotion.color;
                bubble.style.boxShadow = `6px 6px 0px ${emotion.color}`;
                mascot.style.transform = `scale(${1 + rating * 0.03}) rotate(${rating % 2 === 0 ? 5 : -5}deg)`;
                mascot.style.borderColor = emotion.color;
                setTimeout(() => {
                    mascot.style.transform = `scale(${1 + rating * 0.03}) rotate(0deg)`;
                }, 200);
            });
        });

        const commentInput = document.getElementById('comment');
        if (commentInput) {
            commentInput.addEventListener('input', () => {
                if (rating > 0) mascot.style.transform = `scale(${1.1 + rating * 0.03}) rotate(5deg)`;
            });
            commentInput.addEventListener('blur', () => {
                mascot.style.transform = `scale(${1 + rating * 0.03})`;
            });
        }

        function isValidEmail(value) {
            return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
        }

        emailInput.addEventListener('blur', () => {
            const valid = isValidEmail(emailInput.value);
            emailInput.classList.toggle('input-error', !valid);
            emailError.classList.toggle('show', !valid);
        });

        photoInput.addEventListener('change', () => {
            const file = photoInput.files[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) {
                alert("Chỉ chọn được file ảnh thôi nha!");
                photoInput.value = "";
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const MAX_DIM = 800;
                    let { width, height } = img;
                    if (width > height && width > MAX_DIM) {
                        height *= MAX_DIM / width; width = MAX_DIM;
                    } else if (height > MAX_DIM) {
                        width *= MAX_DIM / height; height = MAX_DIM;
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = width; canvas.height = height;
                    canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
                    photoBase64 = dataUrl.split(',')[1];
                    photoMime = 'image/jpeg';
                    photoPreview.src = dataUrl;
                    photoPreviewWrap.classList.add('show');
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });

        removePhotoBtn.addEventListener('click', () => {
            photoBase64 = ""; photoMime = "";
            photoInput.value = "";
            photoPreview.src = "";
            photoPreviewWrap.classList.remove('show');
        });

        sendBtn.addEventListener('click', async function() {
            const email = emailInput.value.trim();
            const service = document.getElementById('service').value;
            const comment = commentInput.value;

            const emailValid = isValidEmail(email);
            emailInput.classList.toggle('input-error', !emailValid);
            emailError.classList.toggle('show', !emailValid);

            if (!emailValid || !service || !comment || rating === 0) {
                alert("Điền đủ thông tin (kể cả email) và chấm sao đã bạn ơii! 🐾");
                return;
            }

            this.disabled = true;
            const originalText = this.innerText;
            this.innerText = "Đang gửi, đợi xíuuu... 🐾";

            try {
                await fetch(SCRIPT_URL, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, service, stars: rating, comment, photoBase64, photoMime })
                });

                makeItRain();
                fillThankYouCard(rating, comment);
                gamification.recordSubmission({ service, stars: rating, comment });
                if (thanksPopup) thanksPopup.style.display = 'flex';

                emailInput.value = '';
                emailInput.classList.remove('input-error');
                emailError.classList.remove('show');
                document.getElementById('service').value = '';
                commentInput.value = '';
                photoBase64 = ""; photoMime = "";
                photoInput.value = "";
                photoPreview.src = "";
                photoPreviewWrap.classList.remove('show');
                rating = 0;
                stars.forEach(star => star.classList.remove('active'));
                bubble.innerText = "Đánh giá cho anh nhé!!";
                bubble.style.borderColor = "#ffcccc";
                bubble.style.boxShadow = "6px 6px 0px #ffcccc";
                mascot.src = "https://cataas.com/cat/says/Hello";
                mascot.style.transform = "scale(1)";
            } catch (e) {
                console.error(e);
                alert("Có lỗi rồi, kiểm tra lại URL Script nha!");
            } finally {
                this.disabled = false;
                this.innerText = originalText;
            }
        });

        function fillThankYouCard(ratingValue, commentText) {
            const cardStars = document.getElementById('card-stars');
            const cardMsg = document.getElementById('card-msg');
            const cardMascotImg = document.getElementById('card-mascot-img');
            cardStars.innerText = '★'.repeat(ratingValue) + '☆'.repeat(5 - ratingValue);
            cardMsg.innerText = commentText && commentText.trim() ? `"${commentText.trim()}"` : "Cảm ơn em đã dành thời gian đánh giá!";
            cardMascotImg.src = catEmotions[ratingValue] ? `${catEmotions[ratingValue].img}?t=${Date.now()}` : "https://cataas.com/cat/says/Thank%20You";
        }

        downloadCardBtn.addEventListener('click', () => {
            const cardEl = document.getElementById('thank-you-card');
            downloadCardBtn.disabled = true;
            downloadCardBtn.innerText = "Đang tạo thiệp...";
            html2canvas(cardEl, { backgroundColor: null, useCORS: true, scale: 2 }).then((canvas) => {
                const link = document.createElement('a');
                link.download = `thiep-cam-on-${Date.now()}.png`;
                link.href = canvas.toDataURL('image/png');
                link.click();
                downloadCardBtn.disabled = false;
                downloadCardBtn.innerText = "💌 Tải thiệp cảm ơn";
            }).catch((err) => {
                console.error(err);
                alert("Không tạo được thiệp, thử lại nha!");
                downloadCardBtn.disabled = false;
                downloadCardBtn.innerText = "💌 Tải thiệp cảm ơn";
            });
        });

        if (closePopup) {
            closePopup.addEventListener('click', () => { thanksPopup.style.display = 'none'; });
        }
        window.addEventListener('click', (e) => {
            if (e.target === thanksPopup) thanksPopup.style.display = 'none';
        });
    }

    // ===================================================================
    // VIEW 2: ADMIN PANEL
    // ===================================================================
    function initAdminPanel() {
        let adminKey = sessionStorage.getItem('meow_admin_key') || "";

        const loginScreen = document.getElementById('login-screen');
        const dashboard = document.getElementById('dashboard');
        const keyInput = document.getElementById('admin-key-input');
        const loginBtn = document.getElementById('login-btn');
        const loginError = document.getElementById('login-error');
        const logoutBtn = document.getElementById('logout-btn');
        const refreshBtn = document.getElementById('refresh-btn');
        const loading = document.getElementById('loading');
        const emptyState = document.getElementById('empty-state');
        const feedbackList = document.getElementById('feedback-list');
        const feedbackCount = document.getElementById('feedback-count');
        const cardTemplate = document.getElementById('feedback-card-template');

        if (!loginScreen) return; // an toàn nếu HTML không có admin view

        if (adminKey) {
            showDashboard();
            loadFeedback();
        }

        loginBtn.addEventListener('click', attemptLogin);
        keyInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') attemptLogin(); });

        function attemptLogin() {
            const key = keyInput.value.trim();
            if (!key) return;
            adminKey = key;
            loginError.classList.remove('show');
            loadFeedback(true);
        }

        logoutBtn.addEventListener('click', () => {
            sessionStorage.removeItem('meow_admin_key');
            adminKey = "";
            dashboard.classList.add('hidden');
            loginScreen.classList.remove('hidden');
            keyInput.value = "";
        });

        refreshBtn.addEventListener('click', () => loadFeedback());

        function showDashboard() {
            loginScreen.classList.add('hidden');
            dashboard.classList.remove('hidden');
        }

        async function loadFeedback(isFirstLogin) {
            loading.classList.remove('hidden');
            emptyState.classList.add('hidden');
            feedbackList.innerHTML = "";

            try {
                const url = `${SCRIPT_URL}?action=list&key=${encodeURIComponent(adminKey)}`;
                const res = await fetch(url);
                const json = await res.json();

                if (!json.success) {
                    loading.classList.add('hidden');
                    if (isFirstLogin) loginError.classList.add('show');
                    else alert("Lỗi: " + json.error);
                    return;
                }

                if (isFirstLogin) {
                    sessionStorage.setItem('meow_admin_key', adminKey);
                    showDashboard();
                }

                renderFeedback(json.data);
            } catch (err) {
                console.error(err);
                loading.classList.add('hidden');
                alert("Không kết nối được tới Apps Script. Kiểm tra lại URL / kết nối mạng nha!");
            }
        }

        function renderFeedback(items) {
            loading.classList.add('hidden');
            feedbackCount.innerText = `${items.length} feedback`;

            if (items.length === 0) {
                emptyState.classList.remove('hidden');
                return;
            }

            items.forEach((item) => {
                const node = cardTemplate.content.cloneNode(true);
                const card = node.querySelector('.feedback-card');

                card.querySelector('.card-email').innerText = "📧 " + (item.email || "(không có email)");
                card.querySelector('.card-service').innerText = "📍 " + (item.service || "");
                card.querySelector('.card-time').innerText = formatTime(item.timestamp);
                card.querySelector('.card-stars').innerText = '★'.repeat(item.stars || 0) + '☆'.repeat(5 - (item.stars || 0));
                card.querySelector('.card-comment').innerText = item.comment || "";

                const photoWrap = card.querySelector('.card-photo-wrap');
                if (item.photoUrl) {
                    const link = document.createElement('a');
                    link.href = item.photoUrl;
                    link.target = "_blank";
                    const img = document.createElement('img');
                    img.src = item.photoUrl;
                    link.appendChild(img);
                    photoWrap.appendChild(link);
                }

                const statusEl = card.querySelector('.reply-status');
                const replied = item.replied === "Yes" || item.replied === true;
                statusEl.innerText = replied ? "✅ Đã trả lời" : "⏳ Chưa trả lời";
                statusEl.classList.add(replied ? 'replied' : 'pending');

                const subjectInput = card.querySelector('.reply-subject');
                const messageInput = card.querySelector('.reply-message');
                if (replied && item.replyMessage) messageInput.value = item.replyMessage;

                const sendReplyBtn = card.querySelector('.send-reply-btn');
                sendReplyBtn.addEventListener('click', async () => {
                    const subject = subjectInput.value.trim();
                    const message = messageInput.value.trim();

                    if (!item.email) { alert("Feedback này không có email, không gửi được!"); return; }
                    if (!message) { alert("Viết gì đó vào lời nhắn trước khi gửi nha!"); return; }

                    sendReplyBtn.disabled = true;
                    sendReplyBtn.innerText = "Đang gửi...";

                    try {
                        const res = await fetch(SCRIPT_URL, {
                            method: 'POST',
                            headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // tránh CORS preflight
                            body: JSON.stringify({
                                action: "reply",
                                key: adminKey,
                                rowIndex: item.rowIndex,
                                to: item.email,
                                subject: subject || "Cảm ơn em vì feedback ❤️",
                                message
                            })
                        });
                        const json = await res.json();

                        if (json.success) {
                            statusEl.innerText = "✅ Đã trả lời";
                            statusEl.classList.remove('pending');
                            statusEl.classList.add('replied');
                        } else {
                            alert("Lỗi: " + json.error);
                        }
                    } catch (err) {
                        console.error(err);
                        alert("Gửi thất bại, thử lại nha!");
                    } finally {
                        sendReplyBtn.disabled = false;
                        sendReplyBtn.innerText = "📧 Gửi email trả lời";
                    }
                });

                feedbackList.appendChild(node);
            });
        }

        function formatTime(ts) {
            if (!ts) return "";
            const d = new Date(ts);
            if (isNaN(d.getTime())) return String(ts);
            return d.toLocaleString('vi-VN');
        }
    }
});
