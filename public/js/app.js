/**
 * Yanlış Defterim - Frontend (API Bağlantılı)
 * Pusula Takımı © 2026
 */

// Auth state
let authToken = localStorage.getItem('authToken');
let authUser = JSON.parse(localStorage.getItem('authUser') || 'null');

// Check auth on page load
if (!authToken || !authUser) {
  window.location.href = '/login';
}

function getAuthHeaders() {
  return { 'Authorization': `Bearer ${authToken}` };
}

const API_BASE = "";
const SUBJECTS = {
  "Matematik": ["Fonksiyonlar", "Türev", "İntegral", "Limit", "Olasılık", "Geometri", "Trigonometri", "Sayılar", "Polinomlar"],
  "Fizik": ["Kuvvet", "Hareket", "Enerji", "Elektrik", "Manyetizma", "Optik", "Dalgalar", "Modern Fizik"],
  "Kimya": ["Mol Kavramı", "Asit-Baz", "Organik Kimya", "Kimyasal Denge", "Elektrokimya", "Çözeltiler"],
  "Biyoloji": ["Hücre", "Genetik", "Ekosistem", "Solunum", "Fotosentez", "Sinir Sistemi", "Dolaşım"],
  "Türkçe": ["Paragraf", "Sözcükte Anlam", "Cümlede Anlam", "Dil Bilgisi", "Yazım Kuralları"],
  "Tarih": ["Osmanlı", "İnkılap Tarihi", "Çağdaş Türk Dünya Tarihi", "İlk Türk Devletleri"],
  "Coğrafya": ["Türkiye Coğrafyası", "Dünya Coğrafyası", "Harita Bilgisi", "İklim"]
};

let selectedFile = null;

// ==============================
// BAŞLATMA
// ==============================

document.addEventListener("DOMContentLoaded", () => {
  if (authUser) {
    document.getElementById("userName").textContent = authUser.name;
    document.getElementById("userRoleBadge").textContent = authUser.role === 'teacher' ? 'Öğretmen' : 'Öğrenci';
  }
  setupRoleVisibility();
  setupLogout();
  
  // setupNavigation is now called inside renderSidebar()
  setupUploadForm();
  setupGalleryFilters();
  setupExportImport();
  setupLightbox();
  populateSubjects();
  
  if (authUser && authUser.role === 'teacher') {
    navigateTo('classrooms');
  } else {
    loadDashboard();
    loadGallery();
    loadStats();
  }
});

// ==============================
// API ÇAĞRILARI
// ==============================

async function apiGet(url) {
  const res = await fetch(`${API_BASE}${url}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`API hatası: ${res.status}`);
  return res.json();
}

async function apiDelete(url) {
  const res = await fetch(`${API_BASE}${url}`, { method: "DELETE", headers: getAuthHeaders() });
  if (!res.ok) throw new Error(`API hatası: ${res.status}`);
  return res.json();
}

async function apiPostForm(url, formData) {
  const res = await fetch(`${API_BASE}${url}`, { method: "POST", headers: getAuthHeaders(), body: formData });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || `API hatası: ${res.status}`);
  }
  return res.json();
}

async function apiPost(url, data) {
  const res = await fetch(`${API_BASE}${url}`, { 
    method: "POST", 
    headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || `API hatası: ${res.status}`);
  }
  return res.json();
}

function logout() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('authUser');
  window.location.href = '/login';
}

function setupRoleVisibility() {
  document.body.classList.add(`role-${authUser.role}`);
  renderSidebar();
  
  if (authUser.role === 'teacher') {
    const quickAddBtn = document.getElementById('quickAddBtn');
    if (quickAddBtn) quickAddBtn.classList.add('student-only-hide');
    const uploadNav = document.querySelector('.nav-item[data-page="upload"]');
    if (uploadNav) uploadNav.classList.add('student-only-hide');
  }
}

function setupLogout() {
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', logout);
  }
}

function renderSidebar() {
  const sidebarNav = document.getElementById('sidebarNav');
  if (!sidebarNav) return;

  if (authUser.role === 'teacher') {
    sidebarNav.innerHTML = `
      <a href="#" class="nav-item active" data-page="classrooms">
          <i class="fas fa-chalkboard-teacher"></i>
          <span>Sınıflarım</span>
      </a>
      <a href="#" class="nav-item" data-page="student-analysis">
          <i class="fas fa-user-graduate"></i>
          <span>Öğrenci Analizi</span>
      </a>
    `;
  } else {
    sidebarNav.innerHTML = `
      <a href="#" class="nav-item active" data-page="dashboard">
          <i class="fas fa-chart-pie"></i>
          <span>Dashboard</span>
      </a>
      <a href="#" class="nav-item" data-page="gallery">
          <i class="fas fa-images"></i>
          <span>Soru Galerisi</span>
      </a>
      <a href="#" class="nav-item" data-page="upload">
          <i class="fas fa-camera"></i>
          <span>Soru Ekle</span>
      </a>
      <a href="#" class="nav-item" data-page="study-plan">
          <i class="fas fa-calendar-alt"></i>
          <span>Çalışma Programım</span>
      </a>
      <a href="#" class="nav-item" data-page="report-card">
          <i class="fas fa-award"></i>
          <span>Karnem</span>
      </a>
      <a href="#" class="nav-item" data-page="stats">
          <i class="fas fa-chart-bar"></i>
          <span>İstatistikler</span>
      </a>
      <a href="#" class="nav-item" data-page="my-classroom">
          <i class="fas fa-school"></i>
          <span>Sınıfım</span>
      </a>
      <a href="#" class="nav-item" data-page="my-comments">
          <i class="fas fa-comments"></i>
          <span>Yorumlarım</span>
      </a>
    `;
  }
  
  // Re-attach navigation events to newly rendered items
  setupNavigation();
}

// ==============================
// SINIF VE YORUM FONKSİYONLARI
// ==============================

async function loadMyClassroom() {
  const content = document.getElementById('myClassroomContent');
  if (!content) return;
  try {
    const res = await apiGet('/api/classrooms/my');
    if (res.classroom) {
      content.innerHTML = `
        <div style="padding:2rem; text-align:center; background:var(--light-bg); border-radius:var(--radius-md);">
          <h3 style="margin-bottom:0.5rem; color:var(--primary);">${res.classroom.name}</h3>
          <p style="margin-bottom:1rem; color:var(--text-muted);">Öğretmen: ${res.classroom.teacher_name}</p>
          <button class="btn-danger" onclick="leaveClassroom()">Sınıftan Ayrıl</button>
        </div>
      `;
    } else {
      content.innerHTML = `
        <form id="joinClassroomForm" class="join-classroom-form" style="max-width: 400px; margin: 0 auto; text-align: center; padding: 2rem;">
          <h3 style="margin-bottom: 1rem;">Bir Sınıfa Katıl</h3>
          <input type="text" id="classroomCode" placeholder="Sınıf Kodu (6 haneli)" required class="search-input" style="width: 100%; margin-bottom: 1rem; text-align: center; font-size: 1.2rem; letter-spacing: 2px;">
          <button type="submit" class="btn-primary" style="width: 100%;">Katıl</button>
        </form>
      `;
      document.getElementById('joinClassroomForm').addEventListener('submit', (e) => {
        e.preventDefault();
        joinClassroom(document.getElementById('classroomCode').value);
      });
    }
  } catch (err) {
    content.innerHTML = `<p style="color:var(--danger)">Sınıf bilgisi yüklenemedi.</p>`;
  }
}

async function joinClassroom(code) {
  try {
    await apiPost('/api/classrooms/join', { code });
    showToast('Sınıfa başarıyla katıldınız!', 'success');
    loadMyClassroom();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function leaveClassroom() {
  showConfirm('Sınıftan ayrılmak istediğinize emin misiniz?', '', async () => {
    try {
      await apiDelete('/api/classrooms/leave');
      showToast('Sınıftan ayrıldınız.', 'info');
      loadMyClassroom();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

async function loadMyComments() {
  const list = document.getElementById('myCommentsList');
  if (!list) return;
  try {
    const comments = await apiGet('/api/comments/my');
    if (!comments || comments.length === 0) {
      list.innerHTML = '<div class="empty-state-small"><i class="fas fa-comment-slash"></i><p>Henüz yorum bulunmuyor.</p></div>';
      return;
    }
    list.innerHTML = comments.map(c => `
      <div class="comment-card" style="background:var(--white); padding:1rem; border-radius:var(--radius-md); box-shadow:var(--card-shadow); margin-bottom:1rem; border-left: 4px solid var(--primary);">
        <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
          <strong style="color:var(--dark);"><i class="fas fa-chalkboard-teacher"></i> ${c.teacher_name}</strong>
          <small style="color:var(--text-muted);">${formatDate(c.created_at)}</small>
        </div>
        <p style="color:var(--dark); font-size:0.95rem; line-height:1.5;">${c.comment}</p>
      </div>
    `).join('');
  } catch (err) {
    list.innerHTML = '<p>Yorumlar yüklenemedi.</p>';
  }
}

async function loadTeacherClassrooms() {
  const list = document.getElementById('teacherClassroomsList');
  if (!list) return;
  try {
    const classrooms = await apiGet('/api/classrooms');
    document.getElementById('classroomStudentsSection').style.display = 'none';
    
    const form = document.getElementById('createClassroomForm');
    if(form) {
      form.onsubmit = async (e) => {
        e.preventDefault();
        const name = document.getElementById('newClassroomName').value;
        await createClassroom(name);
        document.getElementById('newClassroomName').value = '';
      };
    }

    if (!classrooms || classrooms.length === 0) {
      list.innerHTML = '<div class="empty-state-small"><i class="fas fa-chalkboard"></i><p>Henüz sınıfınız yok.</p></div>';
      return;
    }
    list.innerHTML = classrooms.map(c => `
      <div class="classroom-card card" onclick="loadClassroomStudents(${c.id}, '${c.name}')" style="cursor:pointer;">
        <div class="card-body">
          <h3 style="color:var(--primary); margin-bottom:0.5rem;">${c.name}</h3>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
            <span class="classroom-code" style="background:var(--light-bg); padding:0.4rem 0.8rem; border-radius:var(--radius-sm); font-family:monospace; font-size:1.1rem; font-weight:bold; letter-spacing:2px;">${c.code} <button class="copy-btn btn-icon" onclick="event.stopPropagation(); navigator.clipboard.writeText('${c.code}'); showToast('Kod kopyalandı!','success');"><i class="fas fa-copy"></i></button></span>
          </div>
          <p style="color:var(--text-muted); font-size:0.85rem;"><i class="fas fa-users"></i> ${c.studentCount} Öğrenci</p>
        </div>
      </div>
    `).join('');
  } catch (err) {
    list.innerHTML = '<p>Sınıflar yüklenemedi.</p>';
  }
}

async function createClassroom(name) {
  try {
    await apiPost('/api/classrooms', { name });
    showToast('Sınıf oluşturuldu!', 'success');
    loadTeacherClassrooms();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function loadClassroomStudents(classroomId, className) {
  document.getElementById('classroomStudentsSection').style.display = 'block';
  document.getElementById('selectedClassroomName').textContent = className + ' Öğrencileri';
  const list = document.getElementById('classroomStudentsList');
  try {
    const students = await apiGet(`/api/classrooms/${classroomId}/students`);
    if (!students || students.length === 0) {
      list.innerHTML = '<div class="empty-state-small"><p>Bu sınıfta öğrenci yok.</p></div>';
      return;
    }
    list.innerHTML = students.map(s => `
      <div class="student-list-item" onclick="loadStudentAnalysis(${s.id}, '${s.name}')" style="display:flex; justify-content:space-between; padding:1rem; border-bottom:1px solid var(--border-color); cursor:pointer;">
        <div style="font-weight:600;"><i class="fas fa-user"></i> ${s.name}</div>
        <div style="color:var(--text-muted); font-size:0.85rem;">${s.questionCount} Soru</div>
      </div>
    `).join('');
  } catch (err) {
    list.innerHTML = '<p>Öğrenciler yüklenemedi.</p>';
  }
}

let currentStudentId = null;

async function loadStudentAnalysis(studentId, studentName) {
  navigateTo('student-analysis');
  currentStudentId = studentId;
  document.getElementById('analysisStudentName').innerHTML = `<i class="fas fa-user-graduate"></i> ${studentName} Analizi`;
  document.getElementById('studentAnalysisContent').style.display = 'block';
  
  try {
    const stats = await apiGet(`/api/students/${studentId}/stats`);
    
    document.getElementById('saTotalQuestions').textContent = stats.total || 0;
    document.getElementById('saWeekQuestions').textContent = stats.weekCount || 0;
    document.getElementById('saWorstSubject').textContent = stats.worstSubject || '-';
    
    renderSubjectChart(stats.bySubject, stats.total, 'saSubjectChart');
    renderDifficultyChart(stats.byDifficulty, 'saDifficultyChart');
    
    const weakList = document.getElementById("saWeakTopicsList");
    if (stats.byTopic && stats.byTopic.length > 0) {
      weakList.innerHTML = stats.byTopic.map(t => `
        <div class="weak-topic-item">
          <div class="topic-info"><span class="topic-subject">${t.subject}</span><span class="topic-name">${t.topic}</span></div>
          <span class="topic-count">${t.count}</span>
        </div>
      `).join("");
    } else {
      weakList.innerHTML = '<div class="empty-state-small"><p>Veri yok</p></div>';
    }
    
    const recentList = document.getElementById("saRecentList");
    const recent = stats.recentQuestions || [];
    if (recent.length > 0) {
      recentList.innerHTML = recent.map(q => `
        <div class="recent-item" onclick="openLightbox(${q.id})">
          <div class="recent-thumb" style="background-image: url('${q.imagePath}')"></div>
          <div class="recent-info">
            <h4>${q.subject} - ${q.topic}</h4>
            <small><span class="badge diff-${q.difficulty}">${q.difficulty}</span> ${formatDate(q.dateAdded)}</small>
          </div>
        </div>
      `).join("");
    } else {
      recentList.innerHTML = '<div class="empty-state-small"><p>Soru yok</p></div>';
    }
    
    loadStudentComments(studentId);
    
    const commentForm = document.getElementById('teacherCommentForm');
    commentForm.onsubmit = async (e) => {
      e.preventDefault();
      const text = document.getElementById('teacherCommentText').value;
      await postComment(studentId, text);
      document.getElementById('teacherCommentText').value = '';
    };
    
  } catch (err) {
    showToast('Öğrenci analizi yüklenemedi', 'error');
  }
}

async function loadStudentComments(studentId) {
  const list = document.getElementById('studentCommentsList');
  if(!list) return;
  try {
    const comments = await apiGet(`/api/comments/student/${studentId}`);
    if(!comments || comments.length === 0) {
      list.innerHTML = '<p style="color:var(--text-muted); font-size:0.9rem;">Önceki yorum bulunmuyor.</p>';
      return;
    }
    list.innerHTML = comments.map(c => `
      <div style="background:var(--light-bg); padding:1rem; border-radius:var(--radius-md); margin-bottom:1rem;">
        <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem; font-size:0.85rem; color:var(--text-muted);">
          <span>${formatDate(c.createdAt)}</span>
        </div>
        <p style="font-size:0.95rem; color:var(--dark);">${c.comment}</p>
      </div>
    `).join('');
  } catch(err) {
    list.innerHTML = '<p>Yorumlar yüklenemedi.</p>';
  }
}

async function postComment(studentId, comment) {
  try {
    await apiPost('/api/comments', { student_id: studentId, comment });
    showToast('Yorum gönderildi', 'success');
    loadStudentComments(studentId);
  } catch(err) {
    showToast(err.message, 'error');
  }
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
    stats: "İstatistikler",
    "my-classroom": "Sınıfım",
    "my-comments": "Yorumlarım",
    "study-plan": "Çalışma Programım",
    classrooms: "Sınıflarım",
    "student-analysis": "Öğrenci Analizi"
  };

  navItems.forEach(item => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      navItems.forEach(n => n.classList.remove("active"));
      item.classList.add("active");
      document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
      document.getElementById(`page-${page}`).classList.add("active");
      pageTitle.textContent = pageTitles[page] || page;
      sidebar.classList.remove("active");

      if (page === "dashboard") loadDashboard();
      if (page === "gallery") loadGallery();
      if (page === "stats") loadStats();
      if (page === "my-classroom") loadMyClassroom();
      if (page === "my-comments") loadMyComments();
      if (page === "study-plan") loadStudyPlan();
      if (page === "report-card") loadReportCard();
      if (page === "classrooms") loadTeacherClassrooms();
    });
  });

  hamburger.addEventListener("click", () => sidebar.classList.toggle("active"));
  sidebarClose.addEventListener("click", () => sidebar.classList.remove("active"));

  quickAddBtn.addEventListener("click", () => navigateTo("upload"));

  const emptyAddBtn = document.getElementById("emptyAddBtn");
  if (emptyAddBtn) emptyAddBtn.addEventListener("click", () => navigateTo("upload"));
}

function navigateTo(page) {
  const navItem = document.querySelector(`[data-page="${page}"]`);
  if (navItem) navItem.click();
}

// ==============================
// YÜKLEME FORMU
// ==============================

function populateSubjects() {
  const select = document.getElementById("subjectSelect");
  const filterSelect = document.getElementById("filterSubject");

  [select, filterSelect].forEach(sel => {
    if (!sel) return;
    const first = sel.querySelector("option");
    sel.innerHTML = "";
    sel.appendChild(first);
    Object.keys(SUBJECTS).forEach(s => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      sel.appendChild(opt);
    });
  });
}

function setupUploadForm() {
  const form = document.getElementById("uploadForm");
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

  fileBtn.addEventListener("click", (e) => { e.preventDefault(); fileInput.click(); });
  cameraBtn.addEventListener("click", (e) => { e.preventDefault(); cameraInput.click(); });

  const handleFile = (file) => {
    if (!file || !file.type.startsWith("image/")) {
      showToast("Lütfen geçerli bir resim dosyası seçin", "error");
      return;
    }
    selectedFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImage.src = e.target.result;
      uploadPlaceholder.style.display = "none";
      uploadPreview.style.display = "flex";
    };
    reader.readAsDataURL(file);
  };

  fileInput.addEventListener("change", (e) => handleFile(e.target.files[0]));
  cameraInput.addEventListener("change", (e) => handleFile(e.target.files[0]));

  uploadArea.addEventListener("dragover", (e) => { e.preventDefault(); uploadArea.classList.add("drag-over"); });
  uploadArea.addEventListener("dragleave", () => uploadArea.classList.remove("drag-over"));
  uploadArea.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadArea.classList.remove("drag-over");
    handleFile(e.dataTransfer.files[0]);
  });

  removeImage.addEventListener("click", () => {
    selectedFile = null;
    previewImage.src = "";
    uploadPlaceholder.style.display = "flex";
    uploadPreview.style.display = "none";
    fileInput.value = "";
    cameraInput.value = "";
  });

  cancelUpload.addEventListener("click", () => navigateTo("dashboard"));

  // FORM SUBMIT — AI ANALİZLİ
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!selectedFile) {
      showToast("Lütfen bir soru fotoğrafı ekleyin", "warning");
      return;
    }

    const subject = document.getElementById("subjectSelect").value;
    if (!subject) {
      showToast("Lütfen bir ders seçin", "warning");
      return;
    }

    // Tags removed
    // Loading state
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalBtnHTML = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> AI Analiz Ediyor...';
    submitBtn.disabled = true;

    try {
      const formData = new FormData();
      formData.append("image", selectedFile);
      formData.append("subject", subject);
      formData.append("notes", document.getElementById("notesInput").value);

      const result = await apiPostForm("/api/questions", formData);

      showToast(`Soru eklendi! Konu: ${result.question.topic} 🎯`, "success");

      // Çözümü göster
      if (result.question.aiSolution) {
        showSolutionModal(result.question);
      }

      // Formu temizle
      form.reset();
      selectedFile = null;
      previewImage.src = "";
      uploadPlaceholder.style.display = "flex";
      uploadPreview.style.display = "none";
      fileInput.value = "";
      cameraInput.value = "";

    } catch (error) {
      showToast(error.message || "Soru eklenirken hata oluştu", "error");
    } finally {
      submitBtn.innerHTML = originalBtnHTML;
      submitBtn.disabled = false;
    }
  });
}

// ==============================
// ÇÖZÜM MODALI
// ==============================

function showSolutionModal(question) {
  // Lightbox'u çözüm göstermek için kullan
  const lightbox = document.getElementById("lightbox");
  const img = document.getElementById("lightboxImage");
  const info = document.getElementById("lightboxInfo");

  img.src = question.imagePath;
  info.innerHTML = `
    <h3>🎯 ${question.subject} - ${question.topic}</h3>
    <span class="badge diff-${question.difficulty}">${question.difficulty}</span>
    <div style="text-align:left; margin-top:1rem; padding:1rem; background:rgba(255,255,255,0.1); border-radius:12px;">
      <h4 style="margin-bottom:0.5rem; color:#00C9A7;">📝 AI Çözümü:</h4>
      <div style="white-space:pre-wrap; font-size:0.9rem; line-height:1.6;">${question.aiSolution}</div>
    </div>
    <div style="margin-top:1rem; display:flex; gap:0.75rem; justify-content:center;">
      <button class="btn-primary" onclick="closeLightbox(); navigateTo('gallery');">
        <i class="fas fa-images"></i> Galeriye Git
      </button>
      <button class="btn-outline" style="color:white; border-color:rgba(255,255,255,0.3);" onclick="closeLightbox(); navigateTo('upload');">
        <i class="fas fa-plus"></i> Yeni Soru
      </button>
    </div>
  `;

  lightbox.classList.add("active");
  document.body.style.overflow = "hidden";
}

// ==============================
// DASHBOARD
// ==============================

async function loadDashboard() {
  try {
    const stats = await apiGet("/api/stats");
    animateCounter("totalQuestions", stats.total);
    animateCounter("weekQuestions", stats.weekCount);
    document.getElementById("worstSubject").textContent = stats.worstSubject;
    animateCounter("subjectCount", stats.uniqueSubjects);

    renderSubjectChart(stats.bySubject, stats.total);
    renderDifficultyChart(stats.byDifficulty);
    loadRecentList();
  } catch (error) {
    console.error("Dashboard yüklenemedi:", error);
  }
}

async function loadRecentList() {
  const container = document.getElementById("recentList");
  if (!container) return;

  try {
    const questions = await apiGet("/api/questions?sort=date-desc");
    const recent = questions.slice(0, 5);

    if (recent.length === 0) {
      container.innerHTML = '<div class="empty-state-small"><i class="fas fa-inbox"></i><p>Henüz soru eklenmedi</p></div>';
      return;
    }

    container.innerHTML = recent.map(q => `
      <div class="recent-item" onclick="openLightbox(${q.id})">
        <div class="recent-thumb" style="background-image: url('${q.imagePath}')"></div>
        <div class="recent-info">
          <h4>${q.subject} - ${q.topic}</h4>
          <small><span class="badge diff-${q.difficulty}">${q.difficulty}</span> ${formatDate(q.dateAdded)}</small>
        </div>
      </div>
    `).join("");
  } catch (error) {
    container.innerHTML = '<div class="empty-state-small"><p>Yüklenemedi</p></div>';
  }
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
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(start + (target - start) * eased);
    if (progress < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

function renderSubjectChart(bySubject, total, containerId = "subjectChart") {
  const container = document.getElementById(containerId);
  if (!container) return;
  if (!bySubject || bySubject.length === 0) {
    container.innerHTML = '<div class="empty-state-small"><i class="fas fa-chart-bar"></i><p>Henüz veri yok</p></div>';
    return;
  }
  container.innerHTML = bySubject.map(s => {
    const pct = total > 0 ? Math.round((s.count / total) * 100) : 0;
    return `<div class="bar-item">
      <span class="bar-label">${s.subject}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%"><span>${s.count}</span></div></div>
    </div>`;
  }).join("");
}

function renderDifficultyChart(byDifficulty, containerId = "difficultyChart") {
  const container = document.getElementById(containerId);
  if (!container) return;
  const counts = { kolay: 0, orta: 0, zor: 0 };
  (byDifficulty || []).forEach(d => { counts[d.difficulty] = d.count; });
  const total = counts.kolay + counts.orta + counts.zor;
  if (total === 0) {
    container.innerHTML = '<div class="empty-state-small"><i class="fas fa-signal"></i><p>Henüz veri yok</p></div>';
    return;
  }
  const max = Math.max(counts.kolay, counts.orta, counts.zor, 1);
  container.innerHTML = `
    <div class="diff-bar-wrapper"><div class="diff-bar easy" style="height:${Math.max((counts.kolay/max)*150,30)}px"><span>${counts.kolay}</span></div><span class="diff-label">Kolay</span></div>
    <div class="diff-bar-wrapper"><div class="diff-bar medium" style="height:${Math.max((counts.orta/max)*150,30)}px"><span>${counts.orta}</span></div><span class="diff-label">Orta</span></div>
    <div class="diff-bar-wrapper"><div class="diff-bar hard" style="height:${Math.max((counts.zor/max)*150,30)}px"><span>${counts.zor}</span></div><span class="diff-label">Zor</span></div>
  `;
}

// ==============================
// GALERİ
// ==============================

function setupGalleryFilters() {
  const filterSubject = document.getElementById("filterSubject");
  const filterTopic = document.getElementById("filterTopic");
  const filterDifficulty = document.getElementById("filterDifficulty");
  const searchInput = document.getElementById("searchInput");
  const sortSelect = document.getElementById("sortSelect");

  const rerender = () => loadGallery();
  filterSubject.addEventListener("change", () => {
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

async function loadGallery() {
  const grid = document.getElementById("galleryGrid");
  if (!grid) return;

  const params = new URLSearchParams();
  const subject = document.getElementById("filterSubject")?.value;
  const topic = document.getElementById("filterTopic")?.value;
  const difficulty = document.getElementById("filterDifficulty")?.value;
  const search = document.getElementById("searchInput")?.value;
  const sort = document.getElementById("sortSelect")?.value;

  if (subject) params.set("subject", subject);
  if (topic) params.set("topic", topic);
  if (difficulty) params.set("difficulty", difficulty);
  if (search) params.set("search", search);
  if (sort) params.set("sort", sort);

  try {
    const questions = await apiGet(`/api/questions?${params}`);

    if (questions.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon"><i class="fas fa-camera-retro"></i></div>
          <h3>Henüz yanlış soru eklenmedi</h3>
          <p>Yanlış yaptığın soruların fotoğrafını çekip buraya ekleyebilirsin!</p>
          <button class="btn-primary btn-lg" onclick="navigateTo('upload')"><i class="fas fa-plus"></i> İlk Soruyu Ekle</button>
        </div>`;
      return;
    }

    grid.innerHTML = questions.map((q, i) => `
      <div class="question-card" style="animation-delay:${i*0.05}s">
        <div class="card-image-wrapper" onclick="openLightbox(${q.id})">
          <img src="${q.imagePath}" alt="${q.subject}" loading="lazy">
          <div class="card-overlay"><span class="icon-search"><i class="fas fa-search-plus"></i> Büyüt</span></div>
        </div>
        <div class="card-content">
          <div class="card-header">
            <span class="card-subject">${q.subject}</span>
            <span class="badge diff-${q.difficulty}">${q.difficulty}</span>
          </div>
          <div class="card-topic">📌 ${q.topic}</div>
          ${q.notes ? `<div class="card-notes">${truncate(q.notes, 60)}</div>` : ""}
          ${q.aiSolution ? `<div class="card-notes" style="color:#00C9A7; font-size:0.75rem;">🤖 AI Çözümü mevcut</div>` : ""}
          <div class="card-tags">${(q.tags||[]).map(t => `<span class="tag">#${t}</span>`).join("")}</div>
          <div class="card-footer">
            <span class="card-date">${formatDate(q.dateAdded)}</span>
            <div style="display: flex; gap: 0.5rem; align-items: center;"><button class="btn-primary" style="padding: 0.3rem 0.6rem; font-size: 0.75rem; border-radius: 20px; box-shadow: 0 2px 4px rgba(108, 99, 255, 0.3);" onclick="event.stopPropagation(); window.generateSimilarQuestions(this.getAttribute('data-sub'), this.getAttribute('data-top'))" data-sub="${q.subject}" data-top="${q.topic}"><i class="fas fa-robot"></i> Benzer Çöz</button><button class="btn-icon btn-delete" onclick="event.stopPropagation(); handleDelete(${q.id})" title="Sil">🗑️</button></div>
          </div>
        </div>
      </div>
    `).join("");
  } catch (error) {
    grid.innerHTML = '<div class="empty-state"><p>Sorular yüklenemedi</p></div>';
  }
}

// ==============================
// SİLME
// ==============================

function handleDelete(id) {
  showConfirm("Bu soruyu silmek istediğine emin misin?", "Bu işlem geri alınamaz.", async () => {
    try {
      await apiDelete(`/api/questions/${id}`);
      showToast("Soru silindi", "info");
      closeLightbox();
      loadDashboard();
      loadGallery();
      loadStats();
    } catch (error) {
      showToast("Silme işlemi başarısız", "error");
    }
  });
}

// ==============================
// İSTATİSTİKLER
// ==============================

async function loadStats() {
  try {
    const stats = await apiGet("/api/stats");

    // Ders bazlı analiz
    const subjectList = document.getElementById("subjectStatsList");
    if (subjectList) {
      if (stats.bySubject.length === 0) {
        subjectList.innerHTML = '<div class="empty-state-small"><i class="fas fa-chart-pie"></i><p>Henüz veri yok</p></div>';
      } else {
        const maxCount = Math.max(...stats.bySubject.map(s => s.count));
        subjectList.innerHTML = stats.bySubject.map(s => `
          <div class="subject-stat-item">
            <span class="subject-name">${s.subject}</span>
            <div class="stat-bar"><div class="stat-bar-fill" style="width:${(s.count/maxCount)*100}%"></div></div>
            <span class="stat-count">${s.count}</span>
          </div>
        `).join("");
      }
    }

    // Haftalık trend
    const weeklyChart = document.getElementById("weeklyChart");
    if (weeklyChart) {
      const days = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];
      const maxDay = Math.max(...stats.weeklyTrend.map(d => d.count), 1);
      weeklyChart.innerHTML = stats.weeklyTrend.map(d => `
        <div class="week-bar-wrapper">
          <div class="week-bar" style="height:${Math.max((d.count/maxDay)*120,4)}px"></div>
          <span class="week-label">${days[d.day]}</span>
        </div>
      `).join("");
    }

    // Zayıf konular
    const weakList = document.getElementById("weakTopicsList");
    if (weakList) {
      if (stats.byTopic.length === 0) {
        weakList.innerHTML = '<div class="empty-state-small"><i class="fas fa-bullseye"></i><p>Henüz veri yok</p></div>';
      } else {
        weakList.innerHTML = stats.byTopic.map(t => `
          <div class="weak-topic-item">
            <div class="topic-info">
              <span class="topic-subject">${t.subject}</span>
              <span class="topic-name">${t.topic}</span>
            </div>
            <span class="topic-count">${t.count}</span>
          </div>
        `).join("");
      }
    }
  } catch (error) {
    console.error("İstatistikler yüklenemedi:", error);
  }
}

// ==============================
// LIGHTBOX
// ==============================

function setupLightbox() {
  const lightbox = document.getElementById("lightbox");
  const closeBtn = document.getElementById("lightboxClose");
  closeBtn.addEventListener("click", closeLightbox);
  lightbox.addEventListener("click", (e) => { if (e.target === lightbox) closeLightbox(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeLightbox(); });
}

async function openLightbox(id) {
  try {
    const q = await apiGet(`/api/questions/${id}`);
    const lightbox = document.getElementById("lightbox");
    const img = document.getElementById("lightboxImage");
    const info = document.getElementById("lightboxInfo");

    img.src = q.imagePath;
    info.innerHTML = `
      <h3>${q.subject} - ${q.topic}</h3>
      <span class="badge diff-${q.difficulty}">${q.difficulty}</span>
      ${q.notes ? `<p>📝 ${q.notes}</p>` : ""}
      ${q.tags?.length ? `<p>${q.tags.map(t => `<span class="tag">#${t}</span>`).join(" ")}</p>` : ""}
      ${q.aiSolution ? `
        <div style="text-align:left; margin-top:1rem; padding:1rem; background:rgba(255,255,255,0.1); border-radius:12px;">
          <h4 style="margin-bottom:0.5rem; color:#00C9A7;">🤖 AI Çözümü:</h4>
          <div style="white-space:pre-wrap; font-size:0.85rem; line-height:1.6;">${q.aiSolution}</div>
        </div>
      ` : ""}
      <p><small>${formatDate(q.dateAdded)}</small></p>
      <button class="btn-danger" onclick="handleDelete(${q.id})"><i class="fas fa-trash"></i> Sil</button>
    `;

    lightbox.classList.add("active");
    document.body.style.overflow = "hidden";
  } catch (error) {
    showToast("Soru yüklenemedi", "error");
  }
}

function closeLightbox() {
  document.getElementById("lightbox").classList.remove("active");
  document.body.style.overflow = "";
}

// ==============================
// TOAST & CONFIRM
// ==============================

function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

let confirmCallback = null;

function showConfirm(title, message, onConfirm) {
  const overlay = document.getElementById("confirmOverlay");
  document.getElementById("confirmTitle").textContent = title;
  document.getElementById("confirmMessage").textContent = message;
  confirmCallback = onConfirm;
  overlay.classList.add("active");
}

document.addEventListener("DOMContentLoaded", () => {
  const overlay = document.getElementById("confirmOverlay");
  document.getElementById("confirmCancel").addEventListener("click", () => {
    overlay.classList.remove("active");
    confirmCallback = null;
  });
  document.getElementById("confirmOk").addEventListener("click", () => {
    overlay.classList.remove("active");
    if (confirmCallback) confirmCallback();
    confirmCallback = null;
  });
});

// ==============================
// EXPORT / IMPORT
// ==============================

function setupExportImport() {
  const eBtn = document.getElementById("exportBtn"); if(eBtn) eBtn.addEventListener("click", async () => {
    try {
      const data = await apiGet("/api/export");
      if (data.length === 0) { showToast("Dışa aktarılacak veri yok", "warning"); return; }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `yanlis_defterim_${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast("Veriler dışa aktarıldı! 📁", "success");
    } catch (error) {
      showToast("Dışa aktarma başarısız", "error");
    }
  });

  const iBtn = document.getElementById("importBtn"); if(iBtn) iBtn.addEventListener("click", () => {
    document.getElementById("importFile").click();
  });
}

// ==============================
// YARDIMCI
// ==============================

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("tr-TR", { day:"numeric", month:"short", year:"numeric" });
}

function truncate(str, len) {
  return str.length <= len ? str : str.substring(0, len) + "...";
}


// ==============================
// AI BENZER SORU (PRATİK) MODU
// ==============================

window.generateSimilarQuestions = async function(subject, topic) {
  let modal = document.getElementById("aiQuizModal");
  let content = document.getElementById("aiQuizContent");
  
  // DYNAMIC MODAL CREATION (prevents HTML cache issues)
  if (!modal) {
    modal = document.createElement('div');
    modal.className = 'confirm-overlay';
    modal.id = 'aiQuizModal';
    modal.style.alignItems = 'flex-start';
    modal.style.paddingTop = '5vh';
    modal.style.zIndex = '2000';
    
    modal.innerHTML = '<div class="card" style="width: 100%; max-width: 600px; max-height: 90vh; overflow-y: auto; background: var(--white); margin: 0 auto;">' +
        '<div class="card-header" style="display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; background: var(--white); z-index: 10; border-bottom: 1px solid #eee;">' +
            '<h2 style="color: var(--primary);"><i class="fas fa-robot"></i> AI Pratik Modu</h2>' +
            '<button class="btn-icon" id="aiQuizClose" style="color: var(--danger);"><i class="fas fa-times"></i></button>' +
        '</div>' +
        '<div class="card-body" id="aiQuizContent" style="padding: 1.5rem;"></div>' +
    '</div>';
    document.body.appendChild(modal);
    content = document.getElementById('aiQuizContent');
    
    document.getElementById('aiQuizClose').addEventListener('click', () => {
      modal.classList.remove('active');
    });
  }
  
  modal.classList.add("active");
  content.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 3rem 1rem;">' +
    '<i class="fas fa-spinner fa-spin fa-3x" style="color:var(--primary); margin-bottom:1rem;"></i>' +
    '<h3 style="color:var(--dark);">Yapay Zeka Soruları Hazırlıyor...</h3>' +
    '<p>Senin için \'' + topic + '\' konusunda yepyeni sorular üretiliyor.</p>' +
  '</div>';

  try {
    const response = await apiPost("/api/generate-similar", { subject, topic });
    
    if (response.success && response.questions) {
      let html = '<div style="margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 2px dashed #eee;">' +
        '<h3 style="color: var(--dark);"><i class="fas fa-bullseye" style="color:var(--primary);"></i> Hedef Konu: ' + topic + '</h3>' +
        '<p style="color: var(--text-muted); font-size: 0.9rem;">Bu konuyla ilgili eksiklerini kapatman için 3 soru hazırladım. Başarılar!</p>' +
      '</div>';
      
      response.questions.forEach((q, idx) => {
        html += '<div class="quiz-card card" style="margin-bottom: 1.5rem; border-left: 4px solid var(--primary); padding: 1.5rem; background: #fafbff;">' +
            '<h4 style="margin-bottom: 1rem; color: var(--primary);">Soru ' + (idx + 1) + '</h4>' +
            '<p style="margin-bottom: 1.5rem; line-height: 1.6; font-size: 1.05rem; color: var(--dark); font-weight: 500;">' + q.questionText + '</p>' +
            '<div class="options" style="display:flex; flex-direction:column; gap:0.5rem; margin-bottom: 1.5rem;">';
              
        Object.entries(q.options).forEach(([key, val]) => {
          html += '<label style="padding: 0.8rem 1rem; border: 2px solid #eee; border-radius: 8px; cursor: pointer; display: flex; gap: 1rem; align-items: flex-start; transition: all 0.2s; background: var(--white);" onmouseover="this.style.borderColor=\'var(--primary)\'" onmouseout="this.style.borderColor=\'#eee\'">' +
                  '<input type="radio" name="q' + idx + '" value="' + key + '" style="margin-top: 4px; transform: scale(1.2);">' +
                  '<span style="color: var(--dark);"><strong>' + key + ')</strong> ' + val + '</span>' +
                '</label>';
        });
        
        // Use custom data attributes to pass the string safely instead of embedding in onclick
        html += '</div>' +
            '<button class="btn-primary check-answer-btn" style="padding: 0.6rem 1.2rem; width: 100%; border-radius: 8px;" data-correct="' + q.correctAnswer + '">' +
              '<i class="fas fa-check"></i> Cevabı Kontrol Et' +
            '</button>' +
            '<div class="answer-result" style="margin-top: 1.5rem; display: none; padding: 1.5rem; border-radius: 8px; background: var(--white); box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #eee;"></div>' +
            '<div class="hidden-solution" style="display:none;">' + q.solution + '</div>' +
          '</div>';
      });
      
      content.innerHTML = html;
      
      // Attach event listeners dynamically to avoid quote parsing issues in HTML
      content.querySelectorAll('.check-answer-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const card = this.closest('.quiz-card');
          const correct = this.getAttribute('data-correct');
          const solutionStr = card.querySelector('.hidden-solution').textContent;
          window.checkAiAnswer(this, correct, solutionStr);
        });
      });
      
    } else {
      content.innerHTML = '<p style="color:var(--danger); text-align:center;">Sorular üretilemedi. Lütfen tekrar dene.</p>';
    }
  } catch (error) {
    content.innerHTML = '<p style="color:var(--danger); text-align:center;">Hata: ' + error.message + '</p>';
  }
}

window.checkAiAnswer = function(btn, correct, solution) {
  const card = btn.closest('.quiz-card');
  const selected = card.querySelector('input[type="radio"]:checked');
  const resultDiv = card.querySelector('.answer-result');
  
  if (!selected) {
    showToast("Lütfen bir şık seçin", "warning");
    return;
  }
  
  const isCorrect = selected.value === correct;
  btn.style.display = 'none';
  resultDiv.style.display = 'block';
  
  card.querySelectorAll('input[type="radio"]').forEach(radio => radio.disabled = true);
  
  if (isCorrect) {
    resultDiv.innerHTML = '<h3 style="color:var(--success); margin-bottom:1rem; display:flex; align-items:center; gap:0.5rem;"><i class="fas fa-check-circle fa-lg"></i> Tebrikler, Doğru Cevap!</h3>';
  } else {
    resultDiv.innerHTML = '<h3 style="color:var(--danger); margin-bottom:1rem; display:flex; align-items:center; gap:0.5rem;"><i class="fas fa-times-circle fa-lg"></i> Yanlış Cevap. Doğru Şık: ' + correct + '</h3>';
  }
  
  try {
    let parsedSolution = solution;
    if (typeof marked !== "undefined") {
      parsedSolution = marked.parse(solution);
    }
    resultDiv.innerHTML += '<div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed #ccc;">' +
      '<h4 style="color:var(--dark); margin-bottom:0.5rem;"><i class="fas fa-lightbulb" style="color:var(--warning)"></i> Adım Adım Çözüm:</h4>' +
      '<div style="line-height:1.6; color:var(--text-muted);">' + parsedSolution + '</div>' +
    '</div>';
  } catch(e) {
    resultDiv.innerHTML += '<p>' + solution + '</p>';
  }
}

// Global close handler for AI Quiz Modal
document.addEventListener('click', (e) => {
  const closeBtn = e.target.closest('#aiQuizClose');
  if (closeBtn) {
    const modal = document.getElementById('aiQuizModal');
    if (modal) {
      modal.classList.remove('active');
    }
  }
});

// Overlay background close handler for AI Quiz Modal
document.addEventListener('click', (e) => {
  if (e.target.id === 'aiQuizModal') {
    e.target.classList.remove('active');
  }
});

// ==============================
// STUDY PLAN LOGIC
// ==============================

async function loadStudyPlan() {
  const card = document.getElementById('studyPlanCard');
  const emptyState = document.getElementById('studyPlanEmptyState');
  const motivationEl = document.getElementById('studyPlanMotivation');
  const scheduleEl = document.getElementById('studyPlanSchedule');
  
  if (!card || !emptyState) return;

  try {
    const data = await apiGet('/api/study-plan');
    if (data && data.plan) {
      emptyState.style.display = 'none';
      card.style.display = 'block';
      
      const plan = data.plan;
      motivationEl.innerHTML = `<i class="fas fa-quote-left"></i> ${plan.motivation_message || 'Harika gidiyorsun!'} <i class="fas fa-quote-right"></i>`;
      
      if (plan.schedule && Array.isArray(plan.schedule)) {
        scheduleEl.innerHTML = plan.schedule.map(dayPlan => `
          <div style="background: var(--light-bg); border-radius: var(--radius-md); padding: 1.5rem; border: 1px solid var(--border-color); box-shadow: 0 4px 6px rgba(0,0,0,0.02);">
            <h4 style="color: var(--primary); margin-bottom: 1rem; font-size: 1.1rem; border-bottom: 2px solid var(--primary-light); padding-bottom: 0.5rem;">
              <i class="far fa-calendar-alt"></i> ${dayPlan.day}
            </h4>
            <ul style="list-style: none; padding: 0; margin: 0;">
              ${dayPlan.tasks.map(task => `
                <li style="margin-bottom: 0.75rem; display: flex; align-items: flex-start; gap: 0.5rem; color: var(--dark); font-size: 0.95rem; line-height: 1.4;">
                  <i class="fas fa-check-circle" style="color: var(--success); margin-top: 0.2rem;"></i>
                  <span>${task}</span>
                </li>
              `).join('')}
            </ul>
          </div>
        `).join('');
      }
    } else {
      emptyState.style.display = 'block';
      card.style.display = 'none';
    }
  } catch (err) {
    console.error(err);
    emptyState.style.display = 'block';
    card.style.display = 'none';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const genBtn = document.getElementById('generateStudyPlanBtn');
  if (genBtn) {
    genBtn.addEventListener('click', async () => {
      const originalHTML = genBtn.innerHTML;
      genBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Yapay Zeka Programı Hazırlıyor...';
      genBtn.disabled = true;

      try {
        const data = await apiPost('/api/study-plan/generate', {});
        showToast("Yapay zeka haftalık programını hazırladı! 🎯", "success");
        loadStudyPlan();
      } catch (err) {
        showToast(err.message || "Bağlantı hatası.", "error");
      } finally {
        genBtn.innerHTML = originalHTML;
        genBtn.disabled = false;
      }
    });
  }
});

// ==============================
// HAFTALIK GELİŞİM KARNESİ
// ==============================
async function loadReportCard() {
  const content = document.getElementById('reportCardContent');
  if (!content) return;
  
  content.innerHTML = `
    <div style="text-align: center; padding: 4rem 1rem; color: #333;">
        <i class="fas fa-spinner fa-spin fa-3x" style="color: #6C63FF; margin-bottom: 1rem;"></i>
        <p style="font-size: 1.1rem;">Karnen hazırlanıyor, lütfen bekle...</p>
    </div>
  `;

  try {
    const data = await apiGet('/api/report-card?t=' + Date.now());
    
    let trendIcon = "fa-minus";
    let trendColor = "#333";
    let trendText = "Değişim yok";
    
    if (data.trend > 0) {
      trendIcon = "fa-arrow-up";
      trendColor = "#e74c3c";
      trendText = `${data.trend} soru arttı`;
    } else if (data.trend < 0) {
      trendIcon = "fa-arrow-down";
      trendColor = "#00C9A7";
      trendText = `${Math.abs(data.trend)} soru azaldı`;
    }

    let topicsHtml = '<p style="color:#333;">Yeterli veri yok.</p>';
    if (data.weakTopics && data.weakTopics.length > 0) {
      topicsHtml = data.weakTopics.map(t => `
        <div style="background: #F8F9FD; border-radius: 12px; padding: 1rem; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center; border: 1px solid #e2e8f0;">
          <span style="font-weight: 600; color: #000;">${t.name}</span>
          <span style="background: rgba(231,76,60,0.1); color: #e74c3c; padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.9rem; font-weight: 700;">${t.count} Yanlış</span>
        </div>
      `).join('');
    }

    content.innerHTML = `
      <div class="dashboard-grid" style="margin-bottom: 2rem;">
        <div class="card" style="border-top: 4px solid #6C63FF; background: #fff; box-shadow: 0 10px 30px rgba(0,0,0,0.05); border-radius: 20px;">
          <div class="card-body" style="text-align: center; padding: 2rem;">
            <i class="fas fa-robot fa-3x" style="color: #6C63FF; margin-bottom: 1rem;"></i>
            <h3 style="color: #000; margin-bottom: 1rem;">${data.status}</h3>
            <p style="font-size: 1.1rem; line-height: 1.6; color: #333; font-style: italic;">"${data.aiMessage}"</p>
          </div>
        </div>
      </div>
      
      <div class="dashboard-grid">
        <div class="card" style="background: #fff; box-shadow: 0 10px 30px rgba(0,0,0,0.05); border-radius: 20px;">
          <div class="card-header" style="padding: 1.5rem; border-bottom: 1px solid #e2e8f0;">
            <h2 style="color: #000; font-size: 1.25rem;"><i class="fas fa-chart-bar" style="color:#6C63FF; margin-right:8px;"></i> Genel Durum Özeti</h2>
          </div>
          <div class="card-body" style="display: flex; justify-content: space-around; align-items: center; padding: 2rem 1rem;">
            <div style="text-align: center;">
              <p style="color: #333; font-size: 0.9rem; margin-bottom: 0.5rem;">Tüm Zamanlar</p>
              <h3 style="font-size: 2.5rem; color: #000;">${data.allTimeCount}</h3>
            </div>
            <div style="text-align: center; color: #00C9A7;"><i class="fas fa-fire fa-2x" style="margin-bottom: 0.5rem;"></i><p style="font-weight: 700;">Aktif Çalışma</p></div>
            <div style="text-align: center;">
              <p style="color: #333; font-size: 0.9rem; margin-bottom: 0.5rem;">Bu Hafta</p>
              <h3 style="font-size: 2.5rem; color: #000;">${data.thisWeekCount}</h3>
            </div>
          </div>
        </div>
        
        <div class="card" style="background: #fff; box-shadow: 0 10px 30px rgba(0,0,0,0.05); border-radius: 20px;">
          <div class="card-header" style="padding: 1.5rem; border-bottom: 1px solid #e2e8f0;">
            <h2 style="color: #000; font-size: 1.25rem;"><i class="fas fa-exclamation-triangle" style="color:#6C63FF; margin-right:8px;"></i> En Çok Zorlanılan Konular</h2>
          </div>
          <div class="card-body" style="padding: 1.5rem;">
            ${topicsHtml}
          </div>
        </div>
      </div>
    `;
    
    const dlBtn = document.getElementById('downloadPdfBtn');
    if (dlBtn) {
      dlBtn.style.display = 'inline-block';
      dlBtn.onclick = () => { document.body.classList.add('print-report'); window.print(); setTimeout(() => document.body.classList.remove('print-report'), 1000); };
    }
  } catch (err) {
    console.error(err);
    content.innerHTML = `
      <div style="text-align: center; padding: 4rem 1rem; color: #e74c3c;">
          <i class="fas fa-exclamation-circle fa-3x" style="margin-bottom: 1rem;"></i>
          <p style="font-size: 1.1rem;">Karnen yüklenirken bir hata oluştu.</p>
      </div>
    `;
  }
}



window.printStudyPlan = function() {
    document.body.classList.add('print-study');
    window.print();
    setTimeout(() => {
        document.body.classList.remove('print-study');
    }, 1000);
};
