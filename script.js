// Backend endpoint and confirmed request transport are in backend-client.js.

document.addEventListener('DOMContentLoaded', () => {
    const feedbackView = document.getElementById('feedback-view');
    const adminView = document.getElementById('admin-view');

    initCursorFollower();
    initPawPrints();
    initServiceWorker();
    initInstallApp();
    const gamification = initGamification();
    initFeedbackForm(gamification);
    initAdminPanel();
    initViewSwitcher();

    // ===================================================================
    // PWA: đăng ký service worker (cài app + dùng offline)
    // ===================================================================
    function initServiceWorker() {
        if ('serviceWorker' in navigator) {
            const register = () => {
                navigator.serviceWorker.register('sw.js').catch((err) => {
                    console.warn('Không đăng ký được service worker:', err);
                });
            };
            if (document.readyState === 'complete') register();
            else window.addEventListener('load', register, { once: true });
        }
    }

    function initInstallApp() {
        const button = document.getElementById('install-app-btn');
        const help = document.getElementById('install-help');
        const close = document.getElementById('close-install-help');
        let deferred = null;
        const standalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
        const update = () => { button.hidden = standalone(); };
        update();
        window.addEventListener('beforeinstallprompt', event => {
            event.preventDefault();
            deferred = event;
            update();
        });
        window.addEventListener('appinstalled', () => { deferred = null; button.hidden = true; help.hidden = true; });
        window.matchMedia('(display-mode: standalone)').addEventListener('change', update);
        button.addEventListener('click', async () => {
            if (!deferred) { help.hidden = !help.hidden; return; }
            const prompt = deferred;
            deferred = null;
            button.disabled = true;
            try { await prompt.prompt(); await prompt.userChoice; }
            catch (err) { help.hidden = false; }
            finally { button.disabled = false; }
        });
        close.addEventListener('click', () => { help.hidden = true; });
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
                const history = JSON.parse(localStorage.getItem(HISTORY_KEY));
                if (!Array.isArray(history)) return [];
                return history.filter(h => h && Number.isInteger(h.stars) && h.stars >= 1 && h.stars <= 5
                    && Number.isFinite(h.ts) && !isNaN(new Date(h.ts).getTime()))
                    .map(h => ({ ...h, service: String(h.service || ''), comment: String(h.comment || '') }))
                    .slice(0, MAX_HISTORY);
            } catch (e) {
                return [];
            }
        }

        function saveHistory(history) {
            try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY))); }
            catch (err) { console.warn('Không lưu được lịch sử trên thiết bị:', err); }
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

            const updated = [{ ts: Date.now(), ...entry }, ...before].slice(0, MAX_HISTORY);
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
        document.getElementById('open-admin-btn').addEventListener('click', showAdmin);

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
        let photoBusy = false;
        let photoVersion = 0;
        let submission = null;

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
        const formStatus = document.getElementById('form-status');
        const criteriaLabels = { punctuality: 'Đúng giờ', care: 'Chu đáo', attitude: 'Thái độ' };
        const criteriaInputs = [];
        Object.entries(criteriaLabels).forEach(([key, label]) => {
            const group = document.createElement('fieldset');
            group.className = 'criterion-row';
            const legend = document.createElement('legend');
            legend.textContent = label;
            group.appendChild(legend);
            for (let score = 1; score <= 5; score++) {
                const choice = document.createElement('label');
                const input = document.createElement('input');
                input.type = 'radio'; input.name = 'criterion-' + key; input.value = score;
                input.setAttribute('aria-label', `${label}: ${score} sao`);
                const text = document.createElement('span'); text.textContent = `${score} ★`;
                choice.append(input, text); group.appendChild(choice); criteriaInputs.push(input);
                input.addEventListener('click', () => {
                    if (!sendBtn.disabled) showCatReaction(score, text, label);
                });
            }
            const clear = document.createElement('button');
            clear.type = 'button'; clear.className = 'criterion-clear'; clear.textContent = 'Bỏ chọn';
            clear.setAttribute('aria-label', 'Bỏ chọn ' + label);
            clear.addEventListener('click', () => {
                if (sendBtn.disabled) return;
                group.querySelectorAll('input').forEach(input => { input.checked = false; });
                dismissCatReaction();
            });
            group.appendChild(clear);
            document.getElementById('criteria-ratings').appendChild(group);
        });

        const catEmotions = {
            1: { img: "https://cataas.com/cat/angry", msg: "Tệ quá không zay 😿", color: "#ff4d4d" },
            2: { img: "https://cataas.com/cat/sad", msg: "Cố gắng lên 1 xíu nữa xemm 😿", color: "#ff944d" },
            3: { img: "https://cataas.com/cat/cute", msg: "Chắc là cũng ổn thui 😸", color: "#ffd11a" },
            4: { img: "https://cataas.com/cat/says/Great", msg: "Thật sự đỉnh 😻", color: "#54a0ff" },
            5: { img: "https://cataas.com/cat/says/Perfect", msg: "Quá là tuyệt với lun ròii 👑", color: "#ff80ab" }
        };
        let reactionTimer;
        let reactionPopup;
        let reactionAnchor;
        const memeReactions = {
            1: { caption: 'Ủa… một sao thiệt hả? 🥲', src: 'meme-rating-1.jpg', alt: 'Meme mèo khóc' },
            2: { caption: 'Hơi cấn nha… 🤨', src: 'meme-rating-2.jpg', alt: 'Meme mèo nhìn nghi ngờ' },
            3: { caption: 'Cũng ổn áp đó 😌', src: 'meme-rating-3.jpg', alt: 'Meme mèo cười lịch sự' },
            4: { caption: 'Đỉnh của chóp! 🔥', src: 'meme-rating-4.jpg', alt: 'Meme mèo giơ chân tán thưởng' },
            5: { caption: 'Quá trời đỉnh luôn! 🎉', src: 'meme-rating-5.png', alt: 'Meme mèo ăn mừng' }
        };
        Object.values(memeReactions).forEach(meme => { const image = new Image(); image.src = meme.src; });
        function dismissCatReaction() {
            clearTimeout(reactionTimer);
            if (reactionPopup) reactionPopup.remove();
            reactionPopup = null;
            reactionAnchor = null;
        }
        function positionCatReaction() {
            if (!reactionPopup || !reactionAnchor) return;
            const rect = reactionAnchor.getBoundingClientRect();
            if (rect.bottom < 0 || rect.top > innerHeight) { dismissCatReaction(); return; }
            const width = reactionPopup.offsetWidth;
            const height = reactionPopup.offsetHeight;
            reactionPopup.style.left = Math.max(8, Math.min(innerWidth - width - 8, rect.left + rect.width / 2 - width / 2)) + 'px';
            reactionPopup.style.top = Math.max(8, Math.min(innerHeight - height - 16, rect.top > height + 16 ? rect.top - height - 10 : rect.bottom + 10)) + 'px';
        }
        function showCatReaction(score, anchor, label) {
            dismissCatReaction();
            const emotion = catEmotions[score];
            mascot.src = emotion.img;
            bubble.innerText = `${label}: ${emotion.msg}`;
            bubble.style.borderColor = emotion.color;
            bubble.style.boxShadow = `6px 6px 0px ${emotion.color}`;
            mascot.style.borderColor = emotion.color;
            mascot.style.transform = `scale(${1 + score * 0.03}) rotate(${score % 2 === 0 ? 5 : -5}deg)`;
            setTimeout(() => { mascot.style.transform = `scale(${1 + score * 0.03})`; }, 200);
            const popup = document.createElement('div');
            popup.className = 'cat-rating-reaction';
            popup.dataset.rating = String(score); popup.dataset.category = label;
            popup.setAttribute('role', 'status'); popup.setAttribute('aria-live', 'polite');
            popup.style.setProperty('--reaction-color', emotion.color);
            const meme = memeReactions[score];
            const face = document.createElement('img'); face.className = 'rating-meme';
            face.src = meme.src; face.alt = meme.alt; face.width = 104; face.height = 104;
            const message = document.createElement('span'); message.className = 'meme-message';
            const title = document.createElement('strong'); title.textContent = `${label} · ${score}/5 sao`;
            const caption = document.createElement('span'); caption.className = 'meme-caption'; caption.textContent = meme.caption;
            message.append(title, caption);
            popup.append(face, message); document.body.appendChild(popup);
            reactionPopup = popup;
            reactionAnchor = anchor;
            positionCatReaction();
            reactionTimer = setTimeout(dismissCatReaction, 2600);
        }
        window.addEventListener('scroll', positionCatReaction, { passive: true });
        window.addEventListener('resize', positionCatReaction);

        stars.forEach(s => {
            s.tabIndex = 0;
            s.setAttribute('role', 'button');
            s.setAttribute('aria-label', `${s.dataset.v} sao`);
            s.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); s.click(); }
            });
            s.addEventListener('click', () => {
                if (sendBtn.disabled) return;
                rating = parseInt(s.dataset.v);
                stars.forEach(star => star.classList.toggle('active', star.dataset.v <= rating));
                showCatReaction(rating, s, 'Tổng thể');
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
            const valid = !emailInput.value.trim() || isValidEmail(emailInput.value);
            emailInput.classList.toggle('input-error', !valid);
            emailError.classList.toggle('show', !valid);
        });

        photoInput.addEventListener('change', async () => {
            const version = ++photoVersion;
            const file = photoInput.files[0];
            photoBusy = false;
            photoBase64 = ''; photoMime = '';
            photoPreview.src = ''; photoPreviewWrap.classList.remove('show');
            if (!file) return;
            if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) {
                formStatus.textContent = 'Chọn file ảnh nhỏ hơn 10 MB nhé.';
                photoInput.value = "";
                return;
            }
            photoBusy = true;
            formStatus.textContent = 'Đang chuẩn bị ảnh...';
            try {
                const data = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => resolve(reader.result);
                    reader.onerror = () => reject(new Error('Không đọc được ảnh.'));
                    reader.readAsDataURL(file);
                });
                const img = new Image();
                img.src = data;
                await img.decode();
                if (version !== photoVersion) return;
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
                formStatus.textContent = 'Ảnh đã sẵn sàng.';
            } catch (err) {
                if (version !== photoVersion) return;
                photoBase64 = ''; photoMime = '';
                photoInput.value = '';
                photoPreviewWrap.classList.remove('show');
                formStatus.textContent = 'Không mở được ảnh này. Chọn ảnh khác nhé.';
            } finally { if (version === photoVersion) photoBusy = false; }
        });

        removePhotoBtn.addEventListener('click', () => {
            ++photoVersion;
            photoBusy = false;
            photoBase64 = ""; photoMime = "";
            photoInput.value = "";
            photoPreview.src = "";
            photoPreviewWrap.classList.remove('show');
            formStatus.textContent = '';
        });

        sendBtn.addEventListener('click', async function() {
            const email = emailInput.value.trim();
            if (this.disabled) return;
            if (photoBusy) { formStatus.textContent = 'Đợi ảnh chuẩn bị xong rồi gửi nhé.'; return; }
            const service = document.getElementById('service').value.trim();
            const comment = commentInput.value.trim();

            const emailValid = !email || isValidEmail(email);
            emailInput.classList.toggle('input-error', !emailValid);
            emailError.classList.toggle('show', !emailValid);

            if (!emailValid || !service || !comment || rating === 0) {
                alert("Điền tên dịch vụ, nhận xét và chấm sao nhé. Email có thể bỏ trống 🐾");
                return;
            }

            this.disabled = true;
            const originalText = this.innerText;
            this.innerText = "Đang gửi, đợi xíuuu... 🐾";
            formStatus.textContent = 'Đang lưu đánh giá...';
            const criteria = {};
            criteriaInputs.filter(input => input.checked).forEach(input => { criteria[input.name.replace('criterion-', '')] = Number(input.value); });
            const data = { email, service, stars: rating, comment, photoBase64, photoMime, criteria };
            const snapshot = JSON.stringify(data);
            if (!submission || submission.snapshot !== snapshot) submission = { snapshot, requestId: BackendClient.requestId() };
            const inputs = [emailInput, document.getElementById('service'), commentInput, photoInput, removePhotoBtn, ...criteriaInputs];
            inputs.forEach(input => { input.disabled = true; });

            try {
                const result = await BackendClient.request('submit', { ...data, requestId: submission.requestId });

                makeItRain();
                fillThankYouCard(data.stars, comment);
                gamification.recordSubmission({ service, stars: data.stars, comment, criteria });
                if (thanksPopup) thanksPopup.style.display = 'flex';
                submission = null;
                dismissCatReaction();
                formStatus.textContent = 'Đã lưu đánh giá. ' + (result.warning || '');

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
                criteriaInputs.forEach(input => { input.checked = false; });
                stars.forEach(star => star.classList.remove('active'));
                bubble.innerText = "Đánh giá cho anh nhé!!";
                bubble.style.borderColor = "#ffcccc";
                bubble.style.boxShadow = "6px 6px 0px #ffcccc";
                mascot.src = "https://cataas.com/cat/says/Hello";
                mascot.style.transform = "scale(1)";
            } catch (e) {
                console.error(e);
                formStatus.textContent = e.message || 'Chưa gửi được. Nội dung vẫn được giữ lại.';
            } finally {
                inputs.forEach(input => { input.disabled = false; });
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
            cardMascotImg.src = 'icon-192.png';
        }

        downloadCardBtn.addEventListener('click', async () => {
            downloadCardBtn.disabled = true;
            downloadCardBtn.innerText = "Đang tạo thiệp...";
            try {
                const canvas = document.createElement('canvas');
                canvas.width = 640;
                const context = canvas.getContext('2d');
                context.font = '28px sans-serif';
                const lines = [];
                const paragraphs = document.getElementById('card-msg').innerText.split('\n');
                for (const paragraph of paragraphs) {
                    let line = '';
                    for (const character of paragraph) {
                        if (context.measureText(line + character).width > 530) { lines.push(line); line = ''; }
                        line += character;
                    }
                    lines.push(line);
                }
                const visible = lines.slice(0, 20);
                if (lines.length > 20) visible[19] += '…';
                canvas.height = 340 + visible.length * 38;
                const gradient = context.createLinearGradient(0, 0, 640, canvas.height);
                gradient.addColorStop(0, '#fff9f0'); gradient.addColorStop(1, '#ffe6f0');
                context.fillStyle = gradient; context.fillRect(0, 0, 640, canvas.height);
                context.strokeStyle = '#2d3436'; context.lineWidth = 8;
                context.strokeRect(4, 4, 632, canvas.height - 8);
                const image = new Image();
                image.src = 'icon-192.png';
                try { await image.decode(); context.drawImage(image, 260, 32, 120, 120); }
                catch (err) { context.font = '70px sans-serif'; context.fillText('🐱', 275, 120); }
                context.textAlign = 'center';
                context.fillStyle = '#ff9f43'; context.font = '46px sans-serif';
                context.fillText(document.getElementById('card-stars').innerText, 320, 220);
                context.fillStyle = '#2d3436'; context.font = '28px sans-serif';
                visible.forEach((line, i) => context.fillText(line, 320, 280 + i * 38));
                context.fillStyle = '#a63660'; context.font = '24px sans-serif';
                context.fillText('Meow Feedback 🐾', 320, canvas.height - 30);
                const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Không tạo được ảnh.')), 'image/png'));
                const objectUrl = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.download = `thiep-cam-on-${Date.now()}.png`;
                link.href = objectUrl;
                document.body.appendChild(link);
                link.click();
                link.remove();
                setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
            } catch (err) {
                console.error(err);
                alert("Không tạo được thiệp, thử lại nha!");
            } finally {
                downloadCardBtn.disabled = false;
                downloadCardBtn.innerText = "💌 Tải thiệp cảm ơn";
            }
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
        let adminKey = '';
        try { adminKey = sessionStorage.getItem('meow_admin_key') || ''; } catch (err) { /* Storage may be blocked. */ }
        let loadVersion = 0;
        let sessionVersion = 0;
        let repliesInFlight = 0;
        const drafts = new Map();

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
        const adminStatus = document.getElementById('admin-status');

        if (!loginScreen) return; // an toàn nếu HTML không có admin view

        if (adminKey) {
            loadFeedback(true);
        }

        loginBtn.addEventListener('click', attemptLogin);
        keyInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') attemptLogin(); });

        function attemptLogin() {
            const key = keyInput.value.trim();
            if (!key || loginBtn.disabled) return;
            adminKey = key;
            loginError.classList.remove('show');
            loadFeedback(true);
        }

        logoutBtn.addEventListener('click', () => {
            ++loadVersion;
            ++sessionVersion;
            repliesInFlight = 0;
            try { sessionStorage.removeItem('meow_admin_key'); } catch (err) { /* Continue logout. */ }
            adminKey = "";
            drafts.clear();
            feedbackList.replaceChildren();
            feedbackCount.textContent = '';
            adminStatus.textContent = '';
            loginBtn.disabled = false;
            refreshBtn.disabled = false;
            loading.classList.add('hidden');
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
            if (repliesInFlight > 0) return;
            const version = ++loadVersion;
            const key = adminKey;
            loading.classList.remove('hidden');
            loginBtn.disabled = true;
            refreshBtn.disabled = true;
            loginError.classList.remove('show');
            adminStatus.textContent = '';

            try {
                const json = await BackendClient.request('list', { key });
                if (version !== loadVersion || key !== adminKey) return;
                if (!Array.isArray(json.data)) throw new Error('Danh sách feedback không hợp lệ. Cập nhật Apps Script.');

                if (isFirstLogin) {
                    try { sessionStorage.setItem('meow_admin_key', key); } catch (err) { /* Session remains in memory. */ }
                    showDashboard();
                }

                renderFeedback(json.data);
            } catch (err) {
                if (version !== loadVersion || key !== adminKey) return;
                console.error(err);
                if (err.code === 'AUTH') {
                    ++sessionVersion;
                    adminKey = '';
                    drafts.clear();
                    feedbackList.replaceChildren();
                    dashboard.classList.add('hidden');
                    loginScreen.classList.remove('hidden');
                    try { sessionStorage.removeItem('meow_admin_key'); } catch (error) { /* Storage may be blocked. */ }
                }
                if (isFirstLogin || err.code === 'AUTH') {
                    loginError.textContent = err.message;
                    loginError.classList.add('show');
                } else adminStatus.textContent = err.message;
            } finally {
                if (version === loadVersion) {
                    loading.classList.add('hidden');
                    loginBtn.disabled = false;
                    refreshBtn.disabled = false;
                }
            }
        }

        function renderFeedback(items) {
            feedbackList.querySelectorAll('.feedback-card').forEach(card => {
                const id = card.dataset.feedbackId;
                const draft = drafts.get(id) || {};
                draft.subject = card.querySelector('.reply-subject').value;
                draft.message = card.querySelector('.reply-message').value;
                drafts.set(id, draft);
            });
            feedbackList.replaceChildren();
            emptyState.classList.add('hidden');
            loading.classList.add('hidden');
            feedbackCount.innerText = `${items.length} feedback`;

            if (items.length === 0) {
                emptyState.classList.remove('hidden');
                return;
            }

            items.forEach((item) => {
                if (!item || typeof item !== 'object') return;
                const node = cardTemplate.content.cloneNode(true);
                const card = node.querySelector('.feedback-card');

                card.querySelector('.card-email').innerText = "📧 " + (item.email || "(không có email)");
                card.querySelector('.card-service').innerText = "📍 " + (item.service || "");
                card.querySelector('.card-time').innerText = formatTime(item.timestamp);
                const stars = Math.max(0, Math.min(5, Math.floor(Number(item.stars) || 0)));
                card.querySelector('.card-stars').innerText = '★'.repeat(stars) + '☆'.repeat(5 - stars);
                card.querySelector('.card-comment').innerText = item.comment || "";
                const criteriaWrap = card.querySelector('.card-criteria');
                Object.entries({ punctuality: 'Đúng giờ', care: 'Chu đáo', attitude: 'Thái độ' }).forEach(([key, label]) => {
                    const score = item.criteria && Number(item.criteria[key]);
                    if (!Number.isInteger(score) || score < 1 || score > 5) return;
                    const line = document.createElement('p');
                    line.textContent = `${label}: ${'★'.repeat(score)}${'☆'.repeat(5 - score)} (${score}/5)`;
                    criteriaWrap.appendChild(line);
                });

                const photoWrap = card.querySelector('.card-photo-wrap');
                if (typeof item.photoUrl === 'string' && /^https:\/\//.test(item.photoUrl)) {
                    const link = document.createElement('a');
                    link.href = item.photoUrl;
                    link.target = "_blank";
                    link.rel = 'noopener noreferrer';
                    link.textContent = '📷 Mở ảnh đính kèm';
                    photoWrap.appendChild(link);
                }

                const statusEl = card.querySelector('.reply-status');
                const replied = item.replied === "Yes" || item.replied === true;
                statusEl.innerText = replied ? "✅ Đã trả lời" : "⏳ Chưa trả lời";
                statusEl.classList.add(replied ? 'replied' : 'pending');

                const subjectInput = card.querySelector('.reply-subject');
                const messageInput = card.querySelector('.reply-message');
                const draftId = item.feedbackId || `${item.rowIndex}:${item.email}`;
                card.dataset.feedbackId = draftId;
                const draft = drafts.get(draftId) || { subject: '', message: item.replyMessage || '', requestId: null, snapshot: null };
                drafts.set(draftId, draft);
                subjectInput.value = draft.subject;
                messageInput.value = draft.message;

                const sendReplyBtn = card.querySelector('.send-reply-btn');
                const resultEl = card.querySelector('.reply-result');
                if (!item.email) {
                    subjectInput.disabled = true; messageInput.disabled = true; sendReplyBtn.disabled = true;
                    resultEl.textContent = 'Người gửi không để lại email.';
                }
                sendReplyBtn.addEventListener('click', async () => {
                    if (sendReplyBtn.disabled || !adminKey) return;
                    const session = sessionVersion;
                    const key = adminKey;
                    const subject = subjectInput.value.trim();
                    const message = messageInput.value.trim();

                    if (!item.email) { alert("Feedback này không có email, không gửi được!"); return; }
                    if (!message) { alert("Viết gì đó vào lời nhắn trước khi gửi nha!"); return; }

                    sendReplyBtn.disabled = true;
                    sendReplyBtn.innerText = "Đang gửi...";
                    subjectInput.disabled = true;
                    messageInput.disabled = true;
                    repliesInFlight++;
                    refreshBtn.disabled = true;
                    resultEl.textContent = 'Đang gửi email...';
                    const snapshot = JSON.stringify({ subject, message });
                    if (draft.snapshot !== snapshot || !draft.requestId) {
                        draft.snapshot = snapshot;
                        draft.requestId = BackendClient.requestId();
                    }

                    try {
                        const json = await BackendClient.request('reply', {
                            key, rowIndex: item.rowIndex, feedbackId: item.feedbackId,
                            to: item.email, subject: subject || 'Cảm ơn em vì feedback ❤️',
                            message, requestId: draft.requestId
                        });
                        if (session !== sessionVersion || key !== adminKey) return;

                        if (json.success) {
                            statusEl.innerText = "✅ Đã trả lời";
                            statusEl.classList.remove('pending');
                            statusEl.classList.add('replied');
                            resultEl.textContent = json.warning || 'Google đã nhận lệnh gửi email. Nếu chưa thấy thư, kiểm tra mục Spam.';
                            // Keep this ID for repeated clicks on the same reply to prevent duplicate emails.
                        }
                    } catch (err) {
                        if (session !== sessionVersion || key !== adminKey) return;
                        console.error(err);
                        resultEl.textContent = err.message;
                    } finally {
                        if (session === sessionVersion) repliesInFlight--;
                        subjectInput.disabled = false;
                        messageInput.disabled = false;
                        if (session === sessionVersion) refreshBtn.disabled = repliesInFlight > 0;
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
