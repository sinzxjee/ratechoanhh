// Backend endpoint and confirmed request transport are in backend-client.js.

document.addEventListener('DOMContentLoaded', () => {
    const feedbackView = document.getElementById('feedback-view');
    const adminView = document.getElementById('admin-view');

    const petThemes = {
        cat: { name: 'Mèo', greeting: 'ฅ Meow, ynhi ơi!', trail: '🐾' },
        dog: { name: 'Cún', greeting: 'Gâu gâu, ynhi ơi!', trail: '🐾' },
        goat: { name: 'Dê', greeting: 'Be be, ynhi ơi!', trail: '🌿' },
        otter: { name: 'Rái cá', greeting: 'Rái cá chào ynhi!', trail: '🫧' }
    };
    let activePet = 'cat';
    const memePools = {
        cat: [1, 2, 3, 4, 5].map(n => ({ src: `meme-rating-${n}.${n === 5 ? 'png' : 'jpg'}` }))
            .concat(Array.from({ length: 20 }, (_, index) => ({ src: `meme-cat-extra-${String(index + 1).padStart(2, '0')}.webp` }))),
        dog: [1, 2, 3, 4, 5].map(n => ({ src: `meme-dog-${n}.${n === 2 || n === 5 ? 'png' : 'jpg'}` }))
            .concat(Array.from({ length: 5 }, (_, index) => ({ src: `meme-dog-extra-${String(index + 1).padStart(2, '0')}.webp` }))),
        goat: [1, 2, 3, 4, 5].map(n => ({ src: `meme-goat-${n}.jpg` })),
        otter: [1, 2, 3, 4, 5].map(n => ({ src: `meme-otter-${n}.jpg` }))
    };
    function paintMeme(element, score, pet = activePet) {
        const pool = memePools[pet];
        const previous = element.dataset.memeKey;
        const choices = pool.map((_, index) => index).filter(index => String(index) !== previous);
        const index = choices[Math.floor(Math.random() * choices.length)];
        const meme = pool[index];
        element.dataset.memeKey = String(index);
        element.dataset.petScore = String(score);
        element.setAttribute('aria-label', `${petThemes[pet].name} · ${score}/5 sao`);
        if (element.tagName === 'IMG') {
            element.src = meme.src;
            element.style.backgroundImage = '';
        } else {
            element.style.backgroundImage = `url("${meme.src}")`;
            element.style.backgroundSize = 'cover';
            element.style.backgroundPosition = 'center';
        }
    }
    function copyMeme(from, to) {
        to.src = from.src;
        to.dataset.memeKey = from.dataset.memeKey;
        to.dataset.petScore = from.dataset.petScore;
        to.style.backgroundImage = from.style.backgroundImage;
        to.style.backgroundSize = from.style.backgroundSize;
        to.style.backgroundPosition = from.style.backgroundPosition;
    }
    function initPetThemes() {
        const card = document.querySelector('#feedback-view .container');
        let flipTimer;
        function applyPet(key, save) {
            activePet = Object.prototype.hasOwnProperty.call(petThemes, key) ? key : 'cat';
            document.body.dataset.pet = activePet;
            const pet = petThemes[activePet];
            document.querySelector('.cat-welcome').textContent = pet.greeting;
            document.querySelector('.cat-signoff span').textContent = `${pet.name} đang nghe ynhi kể ♡`;
            document.querySelectorAll('.cat-paw-trail span').forEach(el => { el.textContent = pet.trail; });
            document.querySelectorAll('[data-pet-score]').forEach(img => paintMeme(img, Number(img.dataset.petScore)));
            const thanks = document.querySelector('.popup-mascot img');
            if (activePet === 'cat') { thanks.src = 'sleeping-cat.gif'; thanks.style.backgroundImage = ''; }
            else paintMeme(thanks, 5);
            thanks.alt = activePet === 'cat' ? 'Mèo ngủ cảm ơn' : `${pet.name} cảm ơn`;
            document.querySelectorAll('.pet-theme-button').forEach(button => { button.setAttribute('aria-pressed', String(button.dataset.pet === activePet)); });
            document.getElementById('pet-theme-status').textContent = `${pet.name} đang đồng hành cùng ynhi.`;
            if (save) { try { localStorage.setItem('ratechotui_pet_theme', activePet); } catch (err) { /* The selected theme still works without storage. */ } }
            document.dispatchEvent(new Event('pet-theme-change'));
        }
        let saved = 'cat';
        try { saved = localStorage.getItem('ratechotui_pet_theme') || 'cat'; } catch (err) { /* Private browsing may block storage. */ }
        applyPet(saved, false);
        document.querySelectorAll('.pet-theme-button').forEach(button => button.addEventListener('click', () => {
            if (button.dataset.pet === activePet) return;
            window.clearTimeout(flipTimer);
            const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
            if (reduced) { applyPet(button.dataset.pet, true); return; }
            card.classList.remove('pet-card-flip');
            void card.offsetWidth;
            card.classList.add('pet-card-flip');
            applyPet(button.dataset.pet, true);
            flipTimer = window.setTimeout(() => card.classList.remove('pet-card-flip'), 620);
        }));
    }

    initCursorFollower();
    initPawPrints();
    initServiceWorker();
    initFeedbackForm();
    initPetThemes();
    initAdminPanel();
    initViewSwitcher();
    initMobileScrollReveal();

    function initMobileScrollReveal() {
        if (!('IntersectionObserver' in window)) return;
        const mobile = window.matchMedia('(max-width: 600px)');
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        if (!mobile.matches || reducedMotion.matches || document.body.classList.contains('admin-mode')) return;

        const blocks = [...document.querySelectorAll(
            '#feedback-view .form-container > .input-field:not([hidden]), ' +
            '#rating-menu, #send-btn, #pet-theme-picker, .cat-signoff'
        )];
        const calls = { cat: 'Meow!', dog: 'Gâu gâu!', goat: 'Be be!', otter: 'Chíp chíp!' };
        function showPetCall(block) {
            if (!mobile.matches || reducedMotion.matches || document.body.classList.contains('admin-mode')) return;
            const word = document.createElement('span');
            word.className = 'pet-pop-word';
            word.setAttribute('aria-hidden', 'true');
            word.textContent = calls[activePet];
            block.appendChild(word);
            word.addEventListener('animationend', () => word.remove(), { once: true });
        }
        const observer = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
                window.setTimeout(() => showPetCall(entry.target), 180);
            });
        }, { rootMargin: '0px 0px -7% 0px', threshold: 0 });

        blocks.forEach((block, index) => {
            // Keep the first screen visible immediately, including while JS starts.
            if (block.getBoundingClientRect().top < window.innerHeight - 32) return;
            block.style.setProperty('--reveal-delay', `${Math.min(index % 3, 2) * 55}ms`);
            block.classList.add('scroll-reveal');
            observer.observe(block);
        });

        const revealAll = () => {
            if (mobile.matches && !reducedMotion.matches) return;
            observer.disconnect();
            blocks.forEach(block => block.classList.add('is-visible'));
        };
        mobile.addEventListener('change', revealAll);
        reducedMotion.addEventListener('change', revealAll);
    }

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

    // ===================================================================
    // ĐIỀU HƯỚNG GIỮA 2 VIEW (form feedback <-> admin)
    // ===================================================================
    function initViewSwitcher() {
        const mascot = document.getElementById('cat-mascot');
        const backToFormBtn = document.getElementById('back-to-form-btn');
        document.getElementById('open-admin-btn').addEventListener('click', showAdmin);

        function showAdmin() {
            document.body.classList.add('admin-mode');
            feedbackView.classList.add('hidden');
            adminView.classList.remove('hidden');
        }

        function showFeedback() {
            document.body.classList.remove('admin-mode');
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
    function initFeedbackForm() {
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
        const sendBtn = document.getElementById('send-btn');
        const stars = document.querySelectorAll('#stars span');
        const formStatus = document.getElementById('form-status');
        const serviceInput = document.getElementById('service');
        const ratingMenu = document.getElementById('rating-menu');
        const commentInput = document.getElementById('comment');
        // Independent feature switch: set to false to revert step guidance only.
        const ENABLE_STEP_GUIDE = true;
        const guide = document.createElement('div');
        guide.className = 'step-guide';
        guide.hidden = true;
        guide.setAttribute('aria-hidden', 'true');
        guide.innerHTML = '<span class="step-guide-note"></span><svg class="step-guide-arrow" viewBox="0 0 42 58" aria-hidden="true"><path class="step-guide-shaft" d="M8 3 C 40 12, 3 32, 25 48"/><path class="step-guide-head" d="M13 43 L25 49 L31 37"/></svg>';
        const guideNote = guide.querySelector('.step-guide-note');
        function updateGuide() {
            if (!ENABLE_STEP_GUIDE) return;
            if (sendBtn.disabled || thanksPopup.style.display === 'flex') { guide.hidden = true; return; }
            let anchor;
            if (commentInput.value.trim() && rating > 0 && serviceInput.value.trim()) {
                anchor = commentInput.closest('.input-field'); guideNote.textContent = 'Xong rồi! Bấm gửi nhé';
            } else if (rating > 0 && serviceInput.value.trim()) {
                anchor = ratingMenu; guideNote.textContent = 'Tiếp theo: viết nhận xét';
            } else if (serviceInput.value.trim()) {
                anchor = serviceInput.closest('.input-field'); guideNote.textContent = 'Tiếp theo: chấm sao';
            } else { guide.hidden = true; return; }
            anchor.insertAdjacentElement('afterend', guide);
            guide.hidden = false;
            guide.classList.remove('guide-writing');
            void guide.offsetWidth;
            guide.classList.add('guide-writing');
        }
        if (ENABLE_STEP_GUIDE) {
            serviceInput.addEventListener('blur', updateGuide);
            serviceInput.addEventListener('input', () => { if (!serviceInput.value.trim()) updateGuide(); });
            commentInput.addEventListener('blur', updateGuide);
            commentInput.addEventListener('input', () => { if (!commentInput.value.trim()) updateGuide(); });
        }
        const criteriaLabels = { punctuality: 'Đúng giờ', care: 'Chu đáo', attitude: 'Thái độ' };
        const criteriaInputs = [];
        const resetCriteriaMenus = [];
        Object.entries(criteriaLabels).forEach(([key, label]) => {
            const group = document.createElement('fieldset');
            group.className = 'criterion-row';
            const legend = document.createElement('legend');
            legend.textContent = label;
            group.appendChild(legend);
            const menu = document.createElement('details'); menu.className = 'cat-dropdown';
            const summary = document.createElement('summary');
            const preview = document.createElement('img'); preview.alt = ''; preview.width = 42; preview.height = 42; paintMeme(preview, 1);
            const selected = document.createElement('b'); selected.textContent = 'Chọn mức hài lòng';
            summary.append(preview, selected); menu.appendChild(summary);
            const options = document.createElement('div'); options.className = 'cat-dropdown-options'; menu.appendChild(options); group.appendChild(menu);
            const resetMenu = () => { selected.textContent = 'Chọn mức hài lòng'; paintMeme(preview, 1); menu.open = false; };
            resetCriteriaMenus.push(resetMenu);
            menu.addEventListener('toggle', () => { if (menu.open) document.querySelectorAll('.cat-dropdown').forEach(other => { if (other !== menu) other.open = false; }); });
            menu.addEventListener('keydown', e => { if (e.key === 'Escape') { menu.open = false; summary.focus(); } });
            for (let score = 1; score <= 5; score++) {
                const choice = document.createElement('label');
                const input = document.createElement('input');
                input.type = 'radio'; input.name = 'criterion-' + key; input.value = score;
                input.setAttribute('aria-label', `${label}: ${score} sao`);
                const text = document.createElement('span'); text.className = 'criterion-cat-choice';
                const cat = document.createElement('img'); cat.alt = ''; cat.width = 56; cat.height = 56; paintMeme(cat, score);
                const scoreText = document.createElement('small'); scoreText.textContent = `${score} sao`;
                text.append(cat, scoreText);
                choice.append(input, text); options.appendChild(choice); criteriaInputs.push(input);
                input.addEventListener('click', () => {
                    if (!sendBtn.disabled) { selected.textContent = `${score} sao · ${['','Cần cải thiện','Chưa hài lòng','Ổn áp','Rất tốt','Tuyệt vời'][score]}`; copyMeme(cat, preview); menu.open = false; summary.focus(); showCatReaction(score, summary, label); }
                });
            }
            const clear = document.createElement('button');
            clear.type = 'button'; clear.className = 'criterion-clear'; clear.textContent = 'Bỏ chọn';
            clear.setAttribute('aria-label', 'Bỏ chọn ' + label);
            clear.addEventListener('click', () => {
                if (sendBtn.disabled) return;
                group.querySelectorAll('input').forEach(input => { input.checked = false; });
                dismissCatReaction(); resetMenu(); summary.focus();
            });
            options.appendChild(clear);
            document.getElementById('criteria-ratings').appendChild(group);
        });

        const catEmotions = {
            1: { img: "meme-rating-1.jpg", msg: "Tệ quá không zay 😿", color: "#ff4d4d" },
            2: { img: "meme-rating-2.jpg", msg: "Cố gắng lên 1 xíu nữa xemm 😿", color: "#ff944d" },
            3: { img: "meme-rating-3.jpg", msg: "Chắc là cũng ổn thui 😸", color: "#ffd11a" },
            4: { img: "meme-rating-4.jpg", msg: "Thật sự đỉnh 😻", color: "#54a0ff" },
            5: { img: "meme-rating-5.png", msg: "Quá là tuyệt với lun ròii 👑", color: "#ff80ab" }
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
        let mascotScore = 3;
        let memeRotationTimer;
        function setMascotMeme(score) {
            mascotScore = score;
            paintMeme(mascot, score);
            mascot.alt = `Meme ${petThemes[activePet].name} ngẫu nhiên`;
        }
        function stopMemeRotation() { clearInterval(memeRotationTimer); }
        function startMemeRotation() {
            stopMemeRotation();
            if (document.hidden) return;
            memeRotationTimer = setInterval(() => {
                if (feedbackView.classList.contains('hidden') || thanksPopup.style.display === 'flex') return;
                setMascotMeme(mascotScore % 5 + 1);
            }, 3000);
        }
        document.addEventListener('visibilitychange', startMemeRotation);
        window.addEventListener('pagehide', stopMemeRotation);
        window.addEventListener('pageshow', startMemeRotation);
        startMemeRotation();
        document.addEventListener('pet-theme-change', () => { dismissCatReaction(); stars.forEach(star => { paintMeme(star, Number(star.dataset.v)); star.setAttribute('aria-label', `${star.dataset.v} sao`); }); setMascotMeme(mascotScore); startMemeRotation(); });

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
            setMascotMeme(score);
            startMemeRotation();
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
            const face = document.createElement('img'); face.className = 'rating-meme';
            face.alt = `Meme ${petThemes[activePet].name} ngẫu nhiên`; face.width = 104; face.height = 104; paintMeme(face, score);
            const message = document.createElement('span'); message.className = 'meme-message';
            const title = document.createElement('strong'); title.textContent = `${label} · ${score}/5 sao`;
            const caption = document.createElement('span'); caption.className = 'meme-caption'; caption.textContent = memeReactions[score].caption;
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
            paintMeme(s, Number(s.dataset.v));
            s.tabIndex = 0;
            s.setAttribute('role', 'button');
            s.setAttribute('aria-label', `${s.dataset.v} sao`);
            s.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); s.click(); }
            });
            s.addEventListener('click', () => {
                if (sendBtn.disabled) return;
                rating = parseInt(s.dataset.v);
                document.getElementById('rating-menu-status').textContent = `Tổng thể: ${rating}/5 sao`;
                stars.forEach(star => star.classList.toggle('active', star.dataset.v <= rating));
                stars.forEach(star => { paintMeme(star, Number(star.dataset.v)); star.setAttribute('aria-label', `${star.dataset.v} sao`); });
                showCatReaction(rating, s, 'Tổng thể');
                updateGuide();
            });
        });

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
                if (rating === 0) { document.getElementById('rating-menu').open = true; document.querySelector('#rating-menu > summary').focus(); }
                alert('Điền tên dịch vụ, nhận xét và chấm sao nhé 🐾');
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
                if (thanksPopup) thanksPopup.style.display = 'flex';
                submission = null;
                dismissCatReaction();
                formStatus.textContent = 'Đã lưu đánh giá. ' + (result.warning || '');
                guide.hidden = true;

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
                resetCriteriaMenus.forEach(reset => reset());
                document.getElementById('rating-menu').open = false;
                document.getElementById('rating-menu-status').textContent = 'Tổng thể và các tiêu chí';
                stars.forEach(star => star.classList.remove('active'));
                bubble.innerText = "Đánh giá cho anh nhé!!";
                bubble.style.borderColor = "#ffcccc";
                bubble.style.boxShadow = "6px 6px 0px #ffcccc";
                setMascotMeme(3);
                startMemeRotation();
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
