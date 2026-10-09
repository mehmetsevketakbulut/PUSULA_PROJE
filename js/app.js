/**
 * Yanlış Defterim - YKS Yanlış Soru Takip Uygulaması
 * Pusula Takımı © 2026
 */

// ==============================
// VERİ MODELİ & SABİTLER
// ==============================

const SUBJECTS = {
  "Matematik": ["Fonksiyonlar", "Türev", "İntegral", "Limit", "Olasılık", "Geometri", "Trigonometri", "Sayılar", "Polinomlar"],
  "Fizik": ["Kuvvet", "Hareket", "Enerji", "Elektrik", "Manyetizma", "Optik", "Dalgalar", "Modern Fizik"],
  "Kimya": ["Mol Kavramı", "Asit-Baz", "Organik Kimya", "Kimyasal Denge", "Elektrokimya", "Çözeltiler"],
  "Biyoloji": ["Hücre", "Genetik", "Ekosistem", "Solunum", "Fotosentez", "Sinir Sistemi", "Dolaşım"],
  "Türkçe": ["Paragraf", "Sözcükte Anlam", "Cümlede Anlam", "Dil Bilgisi", "Yazım Kuralları"],
  "Tarih": ["Osmanlı", "İnkılap Tarihi", "Çağdaş Türk Dünya Tarihi", "İlk Türk Devletleri"],
  "Coğrafya": ["Türkiye Coğrafyası", "Dünya Coğrafyası", "Harita Bilgisi", "İklim"]
};

const STORAGE_KEY = "yanlis_defterim_data";
let questions = [];
let tempImageData = null;

// ==============================
// BAŞLATMA
// ==============================

document.addEventListener("DOMContentLoaded", () => {
  loadData();
  setupNavigation();
  setupUploadForm();
  setupGalleryFilters();
  setupExportImport();
  setupLightbox();
  populateSubjects();
  renderDashboard();
  renderGallery();
  renderStats();
});

function loadData() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) questions = JSON.parse(data);
  } catch (e) {
    questions = [];
    showToast("Veriler yüklenirken hata oluştu", "error");
  }
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(questions));
  } catch (e) {
    showToast("Depolama alanı dolu olabilir!", "error");
  }
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// ==============================
// NAVİGASYON
// ==============================

function setupNavigation() {
  const navItems = document.querySelectorAll(".nav-item");
  const hamburger = document.getElementById("hamburger");
  const sidebar = document.getElementById("sidebar");
  const sidebarClose = document.getElementById("sidebarClose");
  const quickAddBtn = document.getElementById("quickAddBtn");
  const pageTitle = document.getElementById("pageTitle");

  const pageTitles = {
    dashboard: "Dashboard",
    gallery: "Soru Galerisi",
    upload: "Soru Ekle",
    stats: "İstatistikler"
  };

  navItems.forEach(item => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      
      // Nav active state
      navItems.forEach(n => n.classList.remove("active"));
      item.classList.add("active");

      // Page switch
      document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
      document.getElementById(`page-${page}`).classList.add("active");

      // Title
      pageTitle.textContent = pageTitles[page] || page;

      // Mobile sidebar close
      sidebar.classList.remove("active");

      // Render on page switch
      if (page === "dashboard") renderDashboard();
      if (page === "gallery") renderGallery();
      if (page === "stats") renderStats();
    });
  });

  // Hamburger
  hamburger.addEventListener("click", () => sidebar.classList.toggle("active"));
  sidebarClose.addEventListener("click", () => sidebar.classList.remove("active"));

  // Quick add button
  quickAddBtn.addEventListener("click", () => {
    navItems.forEach(n => n.classList.remove("active"));
    document.querySelector('[data-page="upload"]').classList.add("active");
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    document.getElementById("page-upload").classList.add("active");
    pageTitle.textContent = "Soru Ekle";
  });

  // Empty state add button
  const emptyAddBtn = document.getElementById("emptyAddBtn");
  if (emptyAddBtn) {
    emptyAddBtn.addEventListener("click", () => quickAddBtn.click());
  }
}

function navigateTo(page) {
  const navItem = document.querySelector(`[data-page="${page}"]`);
  if (navItem) navItem.click();
}

// ==============================
// SORU YÖNETİMİ
// ==============================

function addQuestion(data) {
  const question = {
    id: generateId(),
    imageData: data.imageData,
    subject: data.subject,
    topic: data.topic,
    difficulty: data.difficulty || "orta",
    notes: data.notes || "",
    tags: data.tags || [],
    dateAdded: new Date().toISOString()
  };

  questions.push(question);
  saveData();
  showToast("Soru başarıyla eklendi! 🎉", "success");
  renderDashboard();
  renderGallery();
  renderStats();
}

function deleteQuestion(id) {
  showConfirm("Bu soruyu silmek istediğine emin misin?", "Bu işlem geri alınamaz.", () => {
    questions = questions.filter(q => q.id !== id);
    saveData();
    showToast("Soru silindi", "info");
    closeLightbox();
    renderDashboard();
    renderGallery();
    renderStats();
  });
}

function getFilteredQuestions() {
  let filtered = [...questions];
  
  const subject = document.getElementById("filterSubject")?.value;
  const topic = document.getElementById("filterTopic")?.value;
  const difficulty = document.getElementById("filterDifficulty")?.value;
  const search = document.getElementById("searchInput")?.value?.toLowerCase();
  const sort = document.getElementById("sortSelect")?.value;

  if (subject) filtered = filtered.filter(q => q.subject === subject);
  if (topic) filtered = filtered.filter(q => q.topic === topic);
  if (difficulty) filtered = filtered.filter(q => q.difficulty === difficulty);
  if (search) {
    filtered = filtered.filter(q =>
      q.notes?.toLowerCase().includes(search) ||
      q.tags?.some(t => t.toLowerCase().includes(search)) ||
      q.subject.toLowerCase().includes(search) ||
      q.topic.toLowerCase().includes(search)
    );
  }

  // Sıralama
  switch (sort) {
    case "date-asc":
      filtered.sort((a, b) => new Date(a.dateAdded) - new Date(b.dateAdded));
      break;
    case "subject":
      filtered.sort((a, b) => a.subject.localeCompare(b.subject));
      break;
    case "difficulty":
      const dMap = { kolay: 1, orta: 2, zor: 3 };
      filtered.sort((a, b) => dMap[b.difficulty] - dMap[a.difficulty]);
      break;
    default: // date-desc
      filtered.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
  }

  return filtered;
}

// ==============================
// YÜKLEME FORMU
// ==============================

function populateSubjects() {
  const selects = [
    document.getElementById("subjectSelect"),
    document.getElementById("filterSubject")
  ];

  selects.forEach(select => {
    if (!select) return;
    const firstOption = select.querySelector("option");
    select.innerHTML = "";
    select.appendChild(firstOption);
    Object.keys(SUBJECTS).forEach(subject => {
      const opt = document.createElement("option");
      opt.value = subject;
      opt.textContent = subject;
      select.appendChild(opt);
    });
  });
}

function populateTopics(subjectSelect, topicSelect) {
  topicSelect.innerHTML = '<option value="">Konu Seçin</option>';
  const subject = subjectSelect.value;
  
  if (subject && SUBJECTS[subject]) {
    topicSelect.disabled = false;
    SUBJECTS[subject].forEach(topic => {
      const opt = document.createElement("option");
      opt.value = topic;
      opt.textContent = topic;
      topicSelect.appendChild(opt);
    });
  } else {
    topicSelect.disabled = true;
    topicSelect.innerHTML = '<option value="">Önce ders seçin</option>';
  }
}

function setupUploadForm() {
  const form = document.getElementById("uploadForm");
  const subjectSelect = document.getElementById("subjectSelect");
  const topicSelect = document.getElementById("topicSelect");
  const fileInput = document.getElementById("fileInput");
  const cameraInput = document.getElementById("cameraInput");
  const fileBtn = document.getElementById("fileBtn");
  const cameraBtn = document.getElementById("cameraBtn");
  const uploadArea = document.getElementById("uploadArea");
  const uploadPlaceholder = document.getElementById("uploadPlaceholder");
  const uploadPreview = document.getElementById("uploadPreview");
  const previewImage = document.getElementById("previewImage");
  const removeImage = document.getElementById("removeImage");
  const cancelUpload = document.getElementById("cancelUpload");

  // Ders -> Konu bağlantısı
  subjectSelect.addEventListener("change", () => {
    populateTopics(subjectSelect, topicSelect);
  });

  // Dosya seçme
  fileBtn.addEventListener("click", (e) => { e.preventDefault(); fileInput.click(); });
  cameraBtn.addEventListener("click", (e) => { e.preventDefault(); cameraInput.click(); });

  // Dosya işleme
  const handleFile = (file) => {
    if (!file || !file.type.startsWith("image/")) {
      showToast("Lütfen geçerli bir resim dosyası seçin", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      tempImageData = e.target.result;
      previewImage.src = tempImageData;
      uploadPlaceholder.style.display = "none";
      uploadPreview.style.display = "flex";
    };
    reader.readAsDataURL(file);
  };

  fileInput.addEventListener("change", (e) => handleFile(e.target.files[0]));
  cameraInput.addEventListener("change", (e) => handleFile(e.target.files[0]));

  // Drag & Drop
  uploadArea.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadArea.classList.add("drag-over");
  });

  uploadArea.addEventListener("dragleave", () => {
    uploadArea.classList.remove("drag-over");
  });

  uploadArea.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadArea.classList.remove("drag-over");
    handleFile(e.dataTransfer.files[0]);
  });

  // Resim kaldır
  removeImage.addEventListener("click", () => {
    tempImageData = null;
    previewImage.src = "";
    uploadPlaceholder.style.display = "flex";
    uploadPreview.style.display = "none";
    fileInput.value = "";
    cameraInput.value = "";
  });

  // İptal
  cancelUpload.addEventListener("click", () => navigateTo("dashboard"));

  // Form submit
  form.addEventListener("submit", (e) => {
    e.preventDefault();

    if (!tempImageData) {
      showToast("Lütfen bir soru fotoğrafı ekleyin", "warning");
      return;
    }

    if (!subjectSelect.value) {
      showToast("Lütfen bir ders seçin", "warning");
      return;
    }

    if (!topicSelect.value) {
      showToast("Lütfen bir konu seçin", "warning");
      return;
    }

    const tagsRaw = document.getElementById("tagsInput").value;
    const tags = tagsRaw.split(",").map(t => t.trim()).filter(t => t);

    addQuestion({
      imageData: tempImageData,
      subject: subjectSelect.value,
      topic: topicSelect.value,
      difficulty: document.getElementById("difficultySelect").value,
      notes: document.getElementById("notesInput").value,
      tags
    });

    // Form temizle
    form.reset();
    tempImageData = null;
    previewImage.src = "";
    uploadPlaceholder.style.display = "flex";
    uploadPreview.style.display = "none";
    topicSelect.disabled = true;
    topicSelect.innerHTML = '<option value="">Önce ders seçin</option>';
    fileInput.value = "";
    cameraInput.value = "";

    // Dashboard'a dön
    navigateTo("dashboard");
  });
}

// ==============================
// GALERİ FİLTRELERİ
// ==============================

function setupGalleryFilters() {
  const filterSubject = document.getElementById("filterSubject");
  const filterTopic = document.getElementById("filterTopic");
  const filterDifficulty = document.getElementById("filterDifficulty");
  const searchInput = document.getElementById("searchInput");
  const sortSelect = document.getElementById("sortSelect");

  const rerender = () => renderGallery();

  filterSubject.addEventListener("change", () => {
    // Konu filtresini güncelle
    filterTopic.innerHTML = '<option value="">Tüm Konular</option>';
    const subject = filterSubject.value;
    if (subject && SUBJECTS[subject]) {
      SUBJECTS[subject].forEach(topic => {
        const opt = document.createElement("option");
        opt.value = topic;
        opt.textContent = topic;
        filterTopic.appendChild(opt);
      });
    }
    rerender();
  });

  filterTopic.addEventListener("change", rerender);
  filterDifficulty.addEventListener("change", rerender);
  sortSelect.addEventListener("change", rerender);

  let searchTimeout;
  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(rerender, 300);
  });
}

// ==============================
// DASHBOARD RENDER
// ==============================

function renderDashboard() {
  const total = questions.length;
  
  // Haftalık
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const weekCount = questions.filter(q => new Date(q.dateAdded) >= oneWeekAgo).length;

  // Ders bazlı
  const subjectCounts = {};
  const topicCounts = {};
  const difficultyCounts = { kolay: 0, orta: 0, zor: 0 };

  questions.forEach(q => {
    subjectCounts[q.subject] = (subjectCounts[q.subject] || 0) + 1;
    const key = `${q.subject}|${q.topic}`;
    topicCounts[key] = (topicCounts[key] || 0) + 1;
    if (difficultyCounts[q.difficulty] !== undefined) {
      difficultyCounts[q.difficulty]++;
    }
  });

  // En çok yanlış ders
  let worstSubject = "-";
  let maxCount = 0;
  Object.entries(subjectCounts).forEach(([subject, count]) => {
    if (count > maxCount) {
      maxCount = count;
      worstSubject = subject;
    }
  });

  const uniqueSubjects = Object.keys(subjectCounts).length;

  // Sayaçları güncelle
  animateCounter("totalQuestions", total);
  animateCounter("weekQuestions", weekCount);
  document.getElementById("worstSubject").textContent = worstSubject;
  animateCounter("subjectCount", uniqueSubjects);

  // Ders dağılım grafiği
  renderSubjectChart(subjectCounts, total);

  // Son eklenenler
  renderRecentList();

  // Zorluk dağılımı
  renderDifficultyChart(difficultyCounts);
}

function animateCounter(elementId, target) {
  const el = document.getElementById(elementId);
  if (!el || isNaN(target)) return;
  
  const duration = 800;
  const start = parseInt(el.textContent) || 0;
  if (start === target) return;

  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
    const current = Math.round(start + (target - start) * eased);
    el.textContent = current;
    if (progress < 1) requestAnimationFrame(update);
  }

  requestAnimationFrame(update);
}

function renderSubjectChart(subjectCounts, total) {
  const container = document.getElementById("subjectChart");
  if (!container) return;

  if (total === 0) {
    container.innerHTML = '<div class="empty-state-small"><i class="fas fa-chart-bar"></i><p>Henüz veri yok</p></div>';
    return;
  }

  const sorted = Object.entries(subjectCounts).sort((a, b) => b[1] - a[1]);
  
  container.innerHTML = sorted.map(([subject, count]) => {
    const pct = Math.round((count / total) * 100);
    return `
      <div class="bar-item">
        <span class="bar-label">${subject}</span>
        <div class="bar-track">
          <div class="bar-fill" style="width: ${pct}%"><span>${count}</span></div>
        </div>
      </div>
    `;
  }).join("");
}

function renderRecentList() {
  const container = document.getElementById("recentList");
  if (!container) return;

  if (questions.length === 0) {
    container.innerHTML = '<div class="empty-state-small"><i class="fas fa-inbox"></i><p>Henüz soru eklenmedi</p></div>';
    return;
  }

  const recent = [...questions]
    .sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded))
    .slice(0, 5);

  container.innerHTML = recent.map(q => `
    <div class="recent-item" onclick="openLightbox('${q.id}')">
      <div class="recent-thumb" style="background-image: url('${q.imageData}')"></div>
      <div class="recent-info">
        <h4>${q.subject} - ${q.topic}</h4>
        <small><span class="badge diff-${q.difficulty}">${q.difficulty}</span> ${formatDate(q.dateAdded)}</small>
      </div>
    </div>
  `).join("");
}

function renderDifficultyChart(counts) {
  const container = document.getElementById("difficultyChart");
  if (!container) return;

  const total = counts.kolay + counts.orta + counts.zor;
  if (total === 0) {
    container.innerHTML = '<div class="empty-state-small"><i class="fas fa-signal"></i><p>Henüz veri yok</p></div>';
    return;
  }

  const maxVal = Math.max(counts.kolay, counts.orta, counts.zor, 1);

  container.innerHTML = `
    <div class="diff-bar-wrapper">
      <div class="diff-bar easy" style="height: ${Math.max((counts.kolay / maxVal) * 150, 30)}px">
        <span>${counts.kolay}</span>
      </div>
      <span class="diff-label">Kolay</span>
    </div>
    <div class="diff-bar-wrapper">
      <div class="diff-bar medium" style="height: ${Math.max((counts.orta / maxVal) * 150, 30)}px">
        <span>${counts.orta}</span>
      </div>
      <span class="diff-label">Orta</span>
    </div>
    <div class="diff-bar-wrapper">
      <div class="diff-bar hard" style="height: ${Math.max((counts.zor / maxVal) * 150, 30)}px">
        <span>${counts.zor}</span>
      </div>
      <span class="diff-label">Zor</span>
    </div>
  `;
}

// ==============================
// GALERİ RENDER
// ==============================

function renderGallery() {
  const grid = document.getElementById("galleryGrid");
  const emptyState = document.getElementById("galleryEmpty");
  if (!grid) return;

  const filtered = getFilteredQuestions();

  if (filtered.length === 0) {
    grid.innerHTML = "";
    if (questions.length === 0) {
      // Hiç soru yok
      grid.innerHTML = `
        <div class="empty-state" id="galleryEmpty">
          <div class="empty-icon"><i class="fas fa-camera-retro"></i></div>
          <h3>Henüz yanlış soru eklenmedi</h3>
          <p>Yanlış yaptığın soruların fotoğrafını çekip buraya ekleyebilirsin!</p>
          <button class="btn-primary btn-lg" onclick="navigateTo('upload')">
            <i class="fas fa-plus"></i> İlk Soruyu Ekle
          </button>
        </div>
      `;
    } else {
      // Filtre sonucu boş
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i class="fas fa-search"></i></div>
          <h3>Sonuç bulunamadı</h3>
          <p>Filtreleri değiştirerek tekrar deneyin</p>
        </div>
      `;
    }
    return;
  }

  grid.innerHTML = filtered.map((q, i) => `
    <div class="question-card" style="animation-delay: ${i * 0.05}s">
      <div class="card-image-wrapper" onclick="openLightbox('${q.id}')">
        <img src="${q.imageData}" alt="${q.subject} - ${q.topic}" loading="lazy">
        <div class="card-overlay">
          <span class="icon-search"><i class="fas fa-search-plus"></i> Büyüt</span>
        </div>
      </div>
      <div class="card-content">
        <div class="card-header">
          <span class="card-subject">${q.subject}</span>
          <span class="badge diff-${q.difficulty}">${q.difficulty}</span>
        </div>
        <div class="card-topic">${q.topic}</div>
        ${q.notes ? `<div class="card-notes">${truncate(q.notes, 60)}</div>` : ""}
        <div class="card-tags">
          ${(q.tags || []).map(t => `<span class="tag">#${t}</span>`).join("")}
        </div>
        <div class="card-footer">
          <span class="card-date">${formatDate(q.dateAdded)}</span>
          <button class="btn-icon btn-delete" onclick="event.stopPropagation(); deleteQuestion('${q.id}')" title="Sil">
            🗑️
          </button>
        </div>
      </div>
    </div>
  `).join("");
}

// ==============================
// İSTATİSTİKLER
// ==============================

function renderStats() {
  renderSubjectStats();
  renderWeeklyChart();
  renderWeakTopics();
}

function renderSubjectStats() {
  const container = document.getElementById("subjectStatsList");
  if (!container) return;

  if (questions.length === 0) {
    container.innerHTML = '<div class="empty-state-small"><i class="fas fa-chart-pie"></i><p>Henüz veri yok</p></div>';
    return;
  }

  const counts = {};
  questions.forEach(q => { counts[q.subject] = (counts[q.subject] || 0) + 1; });
  const maxCount = Math.max(...Object.values(counts));

  container.innerHTML = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([subject, count]) => `
      <div class="subject-stat-item">
        <span class="subject-name">${subject}</span>
        <div class="stat-bar">
          <div class="stat-bar-fill" style="width: ${(count / maxCount) * 100}%"></div>
        </div>
        <span class="stat-count">${count}</span>
      </div>
    `).join("");
}

function renderWeeklyChart() {
  const container = document.getElementById("weeklyChart");
  if (!container) return;

  const days = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];
  const dayCounts = new Array(7).fill(0);

  // Son 7 gün
  const now = new Date();
  questions.forEach(q => {
    const d = new Date(q.dateAdded);
    const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));
    if (diffDays < 7 && diffDays >= 0) {
      const dayOfWeek = d.getDay();
      // JS: 0=Pazar, düzelt -> 0=Pazartesi
      const idx = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      dayCounts[idx]++;
    }
  });

  const maxDay = Math.max(...dayCounts, 1);

  container.innerHTML = dayCounts.map((count, i) => `
    <div class="week-bar-wrapper">
      <div class="week-bar" style="height: ${Math.max((count / maxDay) * 120, 4)}px"></div>
      <span class="week-label">${days[i]}</span>
    </div>
  `).join("");
}

function renderWeakTopics() {
  const container = document.getElementById("weakTopicsList");
  if (!container) return;

  if (questions.length === 0) {
    container.innerHTML = '<div class="empty-state-small"><i class="fas fa-bullseye"></i><p>Henüz veri yok</p></div>';
    return;
  }

  const topicCounts = {};
  questions.forEach(q => {
    const key = `${q.subject}|${q.topic}`;
    topicCounts[key] = (topicCounts[key] || 0) + 1;
  });

  const sorted = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  container.innerHTML = sorted.map(([key, count]) => {
    const [subject, topic] = key.split("|");
    return `
      <div class="weak-topic-item">
        <div class="topic-info">
          <span class="topic-subject">${subject}</span>
          <span class="topic-name">${topic}</span>
        </div>
        <span class="topic-count">${count}</span>
      </div>
    `;
  }).join("");
}

// ==============================
// LIGHTBOX
// ==============================

function setupLightbox() {
  const lightbox = document.getElementById("lightbox");
  const closeBtn = document.getElementById("lightboxClose");

  closeBtn.addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) closeLightbox();
  });

  // ESC tuşu
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeLightbox();
  });
}

function openLightbox(id) {
  const q = questions.find(q => q.id === id);
  if (!q) return;

  const lightbox = document.getElementById("lightbox");
  const img = document.getElementById("lightboxImage");
  const info = document.getElementById("lightboxInfo");

  img.src = q.imageData;
  info.innerHTML = `
    <h3>${q.subject} - ${q.topic}</h3>
    <span class="badge diff-${q.difficulty}">${q.difficulty}</span>
    <p>${q.notes || "Not eklenmemiş"}</p>
    ${q.tags?.length ? `<p>${q.tags.map(t => `<span class="tag">#${t}</span>`).join(" ")}</p>` : ""}
    <p><small>${formatDate(q.dateAdded)}</small></p>
    <button class="btn-danger" onclick="deleteQuestion('${q.id}')">
      <i class="fas fa-trash"></i> Soruyu Sil
    </button>
  `;

  lightbox.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  document.getElementById("lightbox").classList.remove("active");
  document.body.style.overflow = "";
}

// ==============================
// TOAST BİLDİRİMLERİ
// ==============================

function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  // Animasyon
  requestAnimationFrame(() => toast.classList.add("show"));

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ==============================
// ONAY DİYALOGU
// ==============================

let confirmCallback = null;

function showConfirm(title, message, onConfirm) {
  const overlay = document.getElementById("confirmOverlay");
  document.getElementById("confirmTitle").textContent = title;
  document.getElementById("confirmMessage").textContent = message;
  confirmCallback = onConfirm;
  overlay.classList.add("active");
}

// Event listeners for confirm dialog
document.addEventListener("DOMContentLoaded", () => {
  const overlay = document.getElementById("confirmOverlay");
  const cancelBtn = document.getElementById("confirmCancel");
  const okBtn = document.getElementById("confirmOk");

  cancelBtn.addEventListener("click", () => {
    overlay.classList.remove("active");
    confirmCallback = null;
  });

  okBtn.addEventListener("click", () => {
    overlay.classList.remove("active");
    if (confirmCallback) confirmCallback();
    confirmCallback = null;
  });
});

// ==============================
// EXPORT / IMPORT
// ==============================

function setupExportImport() {
  const exportBtn = document.getElementById("exportBtn");
  const importBtn = document.getElementById("importBtn");
  const importFile = document.getElementById("importFile");

  exportBtn.addEventListener("click", () => {
    if (questions.length === 0) {
      showToast("Dışa aktarılacak veri yok", "warning");
      return;
    }

    const data = JSON.stringify(questions, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `yanlis_defterim_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Veriler başarıyla dışa aktarıldı! 📁", "success");
  });

  importBtn.addEventListener("click", () => importFile.click());

  importFile.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        if (!Array.isArray(imported)) {
          showToast("Geçersiz dosya formatı", "error");
          return;
        }

        showConfirm(
          "Verileri İçe Aktar",
          `${imported.length} soru bulundu. Mevcut verilerle birleştirmek istiyor musun?`,
          () => {
            // Mevcut ID'lerle çakışmaları önle
            const existingIds = new Set(questions.map(q => q.id));
            imported.forEach(q => {
              if (!existingIds.has(q.id)) {
                questions.push(q);
              }
            });
            saveData();
            showToast(`${imported.length} soru içe aktarıldı! 🎉`, "success");
            renderDashboard();
            renderGallery();
            renderStats();
          }
        );
      } catch (err) {
        showToast("Dosya okunurken hata oluştu", "error");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });
}

// ==============================
// YARDIMCI FONKSİYONLAR
// ==============================

function formatDate(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" });
}

function truncate(str, len) {
  if (str.length <= len) return str;
  return str.substring(0, len) + "...";
}
