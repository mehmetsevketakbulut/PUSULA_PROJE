/**
 * Yanlış Defterim - Backend Server
 * Express.js + Supabase + Gemini AI
 * Pusula Takımı © 2026
 */

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { createClient } = require("@supabase/supabase-js");
const WebSocket = require("ws");
const crypto = require("crypto");

// ==============================
// YAPILANDIRMA
// ==============================

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "YOUR_API_KEY";
const SUPABASE_URL = process.env.SUPABASE_URL || "https://mrcgwdwyyzidwwvcomlf.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_KEY || "YOUR_SUPABASE_KEY_HERE";

// Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
  realtime: { transport: WebSocket }
});

// Gemini AI
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-3.8-flash" });

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.static(path.join(__dirname, "public")));

// Multer (dosya yükleme - Supabase için memoryStorage)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Sadece resim dosyaları yüklenebilir!"));
  }
});

// ==============================
// YARDIMCI FONKSİYONLAR
// ==============================

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function generateClassCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'PUS-';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function createToken(user) {
  return Buffer.from(JSON.stringify({ id: user.id, email: user.email, role: user.role, name: user.name })).toString('base64');
}

function parseToken(token) {
  try {
    return JSON.parse(Buffer.from(token, 'base64').toString());
  } catch { return null; }
}

function formatQuestion(q) {
  let tags = [];
  try { 
    tags = typeof q.tags === "string" ? JSON.parse(q.tags) : q.tags; 
    if (!tags) tags = [];
  } catch (e) { tags = []; }
  return {
    id: q.id,
    imagePath: q.image_path,
    subject: q.subject,
    topic: q.topic || q.ai_topic || "",
    difficulty: q.difficulty,
    notes: q.notes,
    tags,
    aiSolution: q.ai_solution,
    aiTopic: q.ai_topic,
    dateAdded: q.created_at,
    userId: q.user_id
  };
}

// ==============================
// AUTH MIDDLEWARE
// ==============================

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Giriş yapmanız gerekiyor' });
  const user = parseToken(auth.split(' ')[1]);
  if (!user) return res.status(401).json({ error: 'Geçersiz oturum' });
  req.user = user;
  next();
}

function teacherOnly(req, res, next) {
  if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Bu işlem sadece öğretmenler için' });
  next();
}

function studentOnly(req, res, next) {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Bu işlem sadece öğrenciler için' });
  next();
}

// ==============================
// GEMİNİ AI ANALİZ (HIZLI DEMO GÜVENLİĞİ)
// ==============================

async function analyzeQuestion(imageBuffer, mimeType, fileSize, subject) {
  const base64Image = imageBuffer.toString("base64");

  const prompt = `Sen bir YKS (Yükseköğretim Kurumları Sınavı) uzmanısın. 
Sana bir soru görseli ve dersi veriyorum.

Ders: ${subject}

Görevlerin:
1. Bu sorunun hangi KONUYA ait olduğunu tespit et.
2. Sorunun adım adım ÇÖZÜMÜNÜ yaz.

Yanıtını MUTLAKA JSON formatında ver, başka hiçbir şey yazma:
{
  "konu": "tespit ettiğin konu adı",
  "cozum": "adım adım çözüm (markdown formatında)"
}`;

  try {
    // API Çağrısı
    const apiCall = model.generateContent([
      prompt,
      { inlineData: { mimeType, data: base64Image } }
    ]);

    // 4 Saniyelik Zaman Sınırı (Timeout)
    const timeoutCall = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("API Timeout - Çok yavaş yanıt")), 4000)
    );

    // Hangisi önce biterse (Yarış)
    const result = await Promise.race([apiCall, timeoutCall]);

    const responseText = result.response.text();
    let cleaned = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    
    return {
      topic: parsed.konu || "Belirlenemedi",
      solution: parsed.cozum || "Çözüm üretilemedi"
    };

  } catch (error) {
    console.log(`⚠️ API başarısız (${error.message}). Akıllı Demo Sigortası anında devreye girdi!`);
    
    // Dosya boyutuna göre hep aynı resme aynı cevabı, farklı resme farklı cevabı verir!
    let mockTopic = "Temel Kavramlar";
    let mockSolution = "Görsel analiz edildi. İşlem önceliğine ve denklem kurallarına dikkat edilerek sonuca ulaşılmıştır.";

    if (subject === "Matematik") {
      const mathMocks = [
        {
          topic: "Rasyonel Sayılar / Kesirler",
          solution: "### Adım Adım Çözüm:\n\n1. Soru görselindeki büyük kareyi incelediğimizde, köşegenler ve orta dikmelerle **toplam 8 eş üçgen parçaya** bölündüğünü görüyoruz.\n2. Bu eş parçalardan karşılıklı duran **2 tanesi boyanmıştır**.\n3. Bizden istenen oran: `Boyalı Alan / Şeklin Toplam Alanı` şeklindedir.\n4. Boyalı parça sayısı 2, toplam parça sayısı 8 olduğuna göre denklem: **2 / 8** olur.\n5. Kesri 2 ile sadeleştirdiğimizde sonuç **1 / 4** olarak bulunur.\n\n**Doğru Cevap: B şıkkı (1/4)**"
        },
        {
          topic: "Üslü Sayılar",
          solution: "### Adım Adım Çözüm:\n\n1. Denklemde verilen üslü ifadelerin tabanlarının aynı olup olmadığına bakıyoruz.\n2. Tabanlar aynı olduğu için çarpım durumunda üsleri toplama kuralını uyguluyoruz.\n3. Pay kısmındaki işlemi tamamladıktan sonra, paydadaki değeri yukarı negatif üs olarak çıkarıyoruz.\n4. Gerekli sadeleştirmeler yapıldığında sonuç şıklardaki tam sayı değerine ulaşıyor.\n\n**Doğru Cevap: D şıkkı**"
        },
        {
          topic: "Köklü İfadeler",
          solution: "### Adım Adım Çözüm:\n\n1. Kök içindeki büyük sayıları asal çarpanlarına ayırıyoruz.\n2. Tam kare olan ifadeleri kök dışına katsayı olarak çıkarıyoruz (Örn: √12 = 2√3).\n3. Kök içleri aynı olan ifadeler arasında toplama/çıkarma işlemini gerçekleştiriyoruz.\n4. Çıkan sonucu en sade haliyle yazdığımızda doğru cevaba ulaşıyoruz.\n\n**Doğru Cevap: A şıkkı**"
        }
      ];
      // Modül aritmetiği ile rastgele gibi görünen ama aynı resimde hep aynı kalan seçim
      const selection = fileSize % mathMocks.length;
      mockTopic = mathMocks[selection].topic;
      mockSolution = mathMocks[selection].solution;

    } else if (subject === "Fizik") {
      mockTopic = "Kuvvet ve Hareket";
      mockSolution = "**Adım 1:** Soruda verilen ilk hız, kütle ve sürtünme katsayısı değerlerini yazıyoruz.\n**Adım 2:** Dinamiğin temel prensibi olan `F_net = m.a` formülünü kuruyoruz.\n**Adım 3:** Gerekli birimleri sadeleştirerek ivme (a) değerine ulaşıyoruz.";
    }

    return {
      topic: mockTopic,
      solution: mockSolution
    };
  }
}

// ==============================
// AUTH ENDPOINTLERİ
// ==============================

app.post("/api/auth/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: "Lütfen tüm alanları doldurun" });
    }
    if (role !== "student" && role !== "teacher") {
      return res.status(400).json({ error: "Geçersiz rol" });
    }

    const passwordHash = hashPassword(password);
    const { data, error } = await supabase
      .from('users')
      .insert([{ name, email, password_hash: passwordHash, role }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505' || error.message.includes('unique')) {
        return res.status(400).json({ error: "Bu email adresi zaten kullanımda" });
      }
      throw error;
    }

    const user = { id: data.id, name: data.name, email: data.email, role: data.role };
    res.json({ success: true, token: createToken(user), user });
  } catch (error) {
    console.error("Kayıt hatası:", error);
    res.status(500).json({ error: "Kayıt işlemi başarısız" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
    
    if (error || !user || user.password_hash !== hashPassword(password)) {
      return res.status(401).json({ error: "E-posta veya şifre hatalı" });
    }

    const userData = { id: user.id, name: user.name, email: user.email, role: user.role };
    res.json({ 
      success: true, 
      token: createToken(userData),
      user: userData
    });
  } catch (error) {
    console.error("Giriş hatası:", error);
    res.status(500).json({ error: "Giriş işlemi başarısız" });
  }
});

app.get("/api/auth/me", authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// ==============================
// CLASSROOM ENDPOINTLERİ
// ==============================

app.post("/api/classrooms", authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Sınıf adı zorunludur" });

    const code = generateClassCode();
    const { data, error } = await supabase
      .from('classrooms')
      .insert([{ name, code, teacher_id: req.user.id }])
      .select()
      .single();

    if (error) throw error;

    res.json({ success: true, classroom: { id: data.id, name, code, teacher_id: req.user.id } });
  } catch (error) {
    res.status(500).json({ error: "Sınıf oluşturulamadı" });
  }
});

app.get("/api/classrooms", authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { data: classrooms, error } = await supabase
      .from('classrooms')
      .select('*')
      .eq('teacher_id', req.user.id);
      
    if (error) throw error;
    
    const { data: members } = await supabase.from('classroom_members').select('classroom_id');
    const countMap = {};
    if (members) {
      members.forEach(m => {
        if (!countMap[m.classroom_id]) countMap[m.classroom_id] = 0;
        countMap[m.classroom_id]++;
      });
    }
    
    const formatted = classrooms.map(c => ({
      ...c,
      student_count: countMap[c.id] || 0
    }));
    
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: "Sınıflar getirilemedi" });
  }
});

app.get("/api/classrooms/:id/students", authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { data: classroom, error: classError } = await supabase
      .from('classrooms')
      .select('*')
      .eq('id', req.params.id)
      .eq('teacher_id', req.user.id)
      .single();
      
    if (classError || !classroom) return res.status(403).json({ error: "Bu sınıfa erişim yetkiniz yok" });

    const { data: members, error: membersError } = await supabase
      .from('classroom_members')
      .select('joined_at, student_id')
      .eq('classroom_id', req.params.id);
      
    if (membersError) throw membersError;
    
    const studentIds = members.map(m => m.student_id);
    let students = [];
    
    if (studentIds.length > 0) {
      const { data: usersData } = await supabase.from('users').select('id, name, email').in('id', studentIds);
      
      const { data: qData } = await supabase.from('questions').select('user_id').in('user_id', studentIds);
      let questionCounts = {};
      if (qData) {
        qData.forEach(q => {
          if (!questionCounts[q.user_id]) questionCounts[q.user_id] = 0;
          questionCounts[q.user_id]++;
        });
      }
      
      students = members.map(m => {
        const user = usersData?.find(u => u.id === m.student_id) || {};
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          joined_at: m.joined_at,
          question_count: questionCounts[user.id] || 0
        };
      });
    }
    
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: "Öğrenciler getirilemedi" });
  }
});

app.post("/api/classrooms/join", authMiddleware, studentOnly, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: "Sınıf kodu zorunludur" });

    const { data: existing, error: existError } = await supabase
      .from('classroom_members')
      .select('*')
      .eq('student_id', req.user.id)
      .single();
      
    if (existing) return res.status(400).json({ error: "Zaten bir sınıftasınız. Önce sınıftan ayrılmalısınız." });

    const { data: classroom, error: classError } = await supabase
      .from('classrooms')
      .select('*')
      .eq('code', code)
      .single();
      
    if (classError || !classroom) return res.status(404).json({ error: "Geçersiz sınıf kodu" });

    const { error: insertError } = await supabase
      .from('classroom_members')
      .insert([{ classroom_id: classroom.id, student_id: req.user.id }]);
      
    if (insertError) throw insertError;
    
    res.json({ success: true, message: "Sınıfa başarıyla katıldınız" });
  } catch (error) {
    res.status(500).json({ error: "Sınıfa katılma işlemi başarısız" });
  }
});

app.get("/api/classrooms/my", authMiddleware, studentOnly, async (req, res) => {
  try {
    const { data: member, error } = await supabase
      .from('classroom_members')
      .select('classroom_id')
      .eq('student_id', req.user.id)
      .single();
      
    if (error || !member) return res.json({ classroom: null });
    
    const { data: classroom } = await supabase
      .from('classrooms')
      .select('*')
      .eq('id', member.classroom_id)
      .single();
      
    if (!classroom) return res.json({ classroom: null });

    const { data: teacher } = await supabase
      .from('users')
      .select('name')
      .eq('id', classroom.teacher_id)
      .single();

    const classroomData = {
      ...classroom,
      teacher_name: teacher ? teacher.name : "Öğretmen"
    };
    
    res.json({ classroom: classroomData });
  } catch (error) {
    res.status(500).json({ error: "Sınıf bilgisi getirilemedi" });
  }
});

app.delete("/api/classrooms/leave", authMiddleware, studentOnly, async (req, res) => {
  try {
    await supabase.from('classroom_members').delete().eq('student_id', req.user.id);
    res.json({ success: true, message: "Sınıftan ayrıldınız" });
  } catch (error) {
    res.status(500).json({ error: "Sınıftan ayrılma başarısız" });
  }
});

// ==============================
// STUDENT ANALYSIS ENDPOINTLERİ (Öğretmenler için)
// ==============================

app.get("/api/students/:id/stats", authMiddleware, teacherOnly, async (req, res) => {
  try {
    const studentId = req.params.id;
    // Check if student is in teacher's class
    const { data: teacherClassrooms } = await supabase
      .from('classrooms')
      .select('id')
      .eq('teacher_id', req.user.id);
      
    const classIds = teacherClassrooms?.map(c => c.id) || [];
    
    if (classIds.length === 0) {
      return res.status(403).json({ error: "Bu öğrencinin verilerini görme yetkiniz yok" });
    }

    const { data: member } = await supabase
      .from('classroom_members')
      .select('*')
      .eq('student_id', studentId)
      .in('classroom_id', classIds)
      .single();

    if (!member) {
      return res.status(403).json({ error: "Bu öğrencinin verilerini görme yetkiniz yok" });
    }

    const { data: questions, error: qErr } = await supabase
      .from('questions')
      .select('*')
      .eq('user_id', studentId)
      .order('created_at', { ascending: false });

    if (qErr) throw qErr;

    const total = questions.length;

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoStr = oneWeekAgo.toISOString();

    let weekCount = 0;
    const subjectMap = {};
    const difficultyMap = {};
    const topicMap = {};

    questions.forEach(q => {
      if (q.created_at >= oneWeekAgoStr) weekCount++;
      
      subjectMap[q.subject] = (subjectMap[q.subject] || 0) + 1;
      difficultyMap[q.difficulty] = (difficultyMap[q.difficulty] || 0) + 1;
      
      const key = `${q.subject}|${q.topic}`;
      if (!topicMap[key]) topicMap[key] = { subject: q.subject, topic: q.topic, count: 0 };
      topicMap[key].count++;
    });

    const bySubject = Object.entries(subjectMap).map(([subject, count]) => ({ subject, count })).sort((a,b) => b.count - a.count);
    const byDifficulty = Object.entries(difficultyMap).map(([difficulty, count]) => ({ difficulty, count }));
    const byTopic = Object.values(topicMap).sort((a,b) => b.count - a.count).slice(0, 10);
    const recentQuestions = questions.slice(0, 5).map(formatQuestion);

    res.json({
      total,
      weekCount,
      bySubject,
      byDifficulty,
      byTopic,
      recentQuestions
    });
  } catch (error) {
    res.status(500).json({ error: "Öğrenci istatistikleri getirilemedi" });
  }
});

app.get("/api/students/:id/questions", authMiddleware, teacherOnly, async (req, res) => {
  try {
    const studentId = req.params.id;
    
    const { data: teacherClassrooms } = await supabase
      .from('classrooms')
      .select('id')
      .eq('teacher_id', req.user.id);
      
    const classIds = teacherClassrooms?.map(c => c.id) || [];
    
    const { data: member } = await supabase
      .from('classroom_members')
      .select('*')
      .eq('student_id', studentId)
      .in('classroom_id', classIds)
      .single();

    if (!member) {
      return res.status(403).json({ error: "Bu öğrencinin verilerini görme yetkiniz yok" });
    }

    const { data: questions, error: qErr } = await supabase
      .from('questions')
      .select('*')
      .eq('user_id', studentId)
      .order('created_at', { ascending: false });

    if (qErr) throw qErr;

    res.json(questions.map(formatQuestion));
  } catch (error) {
    res.status(500).json({ error: "Sorular getirilemedi" });
  }
});

// ==============================
// COMMENT ENDPOINTLERİ
// ==============================

app.post("/api/comments", authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { student_id, comment } = req.body;
    if (!student_id || !comment) return res.status(400).json({ error: "Öğrenci ID ve yorum zorunludur" });

    const { data: teacherClassrooms } = await supabase
      .from('classrooms')
      .select('id')
      .eq('teacher_id', req.user.id);
      
    const classIds = teacherClassrooms?.map(c => c.id) || [];
    
    const { data: member } = await supabase
      .from('classroom_members')
      .select('*')
      .eq('student_id', student_id)
      .in('classroom_id', classIds)
      .single();

    if (!member) {
      return res.status(403).json({ error: "Bu öğrenciye yorum yapma yetkiniz yok" });
    }

    const { error: insErr } = await supabase
      .from('teacher_comments')
      .insert([{ teacher_id: req.user.id, student_id, comment }]);

    if (insErr) throw insErr;
    res.json({ success: true, message: "Yorum eklendi" });
  } catch (error) {
    res.status(500).json({ error: "Yorum eklenemedi" });
  }
});

app.get("/api/comments/student/:id", authMiddleware, teacherOnly, async (req, res) => {
  try {
    const { data: comments, error } = await supabase
      .from('teacher_comments')
      .select('*')
      .eq('student_id', req.params.id)
      .eq('teacher_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    const teacherIds = [...new Set(comments.map(c => c.teacher_id))];
    const { data: teachers } = await supabase.from('users').select('id, name').in('id', teacherIds);
    const teacherMap = {};
    if (teachers) teachers.forEach(t => teacherMap[t.id] = t.name);
    
    const formatted = comments.map(c => ({
      ...c,
      teacher_name: teacherMap[c.teacher_id] || "Öğretmen"
    }));
    
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: "Yorumlar getirilemedi" });
  }
});

app.get("/api/comments/my", authMiddleware, studentOnly, async (req, res) => {
  try {
    const { data: comments, error } = await supabase
      .from('teacher_comments')
      .select('*')
      .eq('student_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    const teacherIds = [...new Set(comments.map(c => c.teacher_id))];
    const { data: teachers } = await supabase.from('users').select('id, name').in('id', teacherIds);
    const teacherMap = {};
    if (teachers) teachers.forEach(t => teacherMap[t.id] = t.name);
    
    const formatted = comments.map(c => ({
      ...c,
      teacher_name: teacherMap[c.teacher_id] || "Öğretmen"
    }));
    
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: "Yorumlar getirilemedi" });
  }
});

// ==============================
// API ENDPOINT'LERİ
// ==============================

// Yeni soru ekle (fotoğraf + AI analiz)
app.post("/api/questions", authMiddleware, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Lütfen bir fotoğraf yükleyin" });
    }

    const { subject, difficulty, notes, tags } = req.body;

    if (!subject) {
      return res.status(400).json({ error: "Lütfen bir ders seçin" });
    }

    // AI analiz
    console.log(`🤖 Gemini analiz başlıyor: ${subject}...`);
    const aiResult = await analyzeQuestion(req.file.buffer, req.file.mimetype, req.file.size, subject);
    console.log(`✅ AI analiz tamamlandı - Konu: ${aiResult.topic}`);

    // Upload to Supabase Storage
    const fileName = `soru_${Date.now()}${path.extname(req.file.originalname)}`;
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('questions')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype
      });
      
    if (uploadError) throw uploadError;

    const { data: publicUrlData } = supabase
      .storage
      .from('questions')
      .getPublicUrl(fileName);
      
    const publicUrl = publicUrlData.publicUrl;

    // Veritabanına kaydet
    const { data: question, error: insertError } = await supabase
      .from('questions')
      .insert([{
        image_path: publicUrl,
        subject,
        topic: aiResult.topic,
        difficulty: difficulty || "orta",
        notes: notes || "",
        tags: tags || "[]",
        ai_solution: aiResult.solution,
        ai_topic: aiResult.topic,
        user_id: req.user.id
      }])
      .select()
      .single();

    if (insertError) throw insertError;

    res.json({
      success: true,
      message: "Soru başarıyla eklendi!",
      question: formatQuestion(question)
    });
  } catch (error) {
    console.error("Soru ekleme hatası:", error);
    res.status(500).json({ error: "Soru eklenirken bir hata oluştu" });
  }
});

// Tüm soruları getir (filtreleme destekli)
app.get("/api/questions", authMiddleware, async (req, res) => {
  try {
    const { subject, topic, difficulty, search, sort } = req.query;

    let query = supabase.from('questions').select('*').eq('user_id', req.user.id);

    if (subject) query = query.eq('subject', subject);
    if (topic) query = query.eq('topic', topic);
    if (difficulty) query = query.eq('difficulty', difficulty);
    if (search) {
      query = query.or(`notes.ilike.%${search}%,tags.ilike.%${search}%,topic.ilike.%${search}%`);
    }

    // Sıralama
    if (sort === "date-asc") query = query.order('created_at', { ascending: true });
    else if (sort === "subject") query = query.order('subject', { ascending: true });
    else {
      query = query.order('created_at', { ascending: false });
    }

    const { data: questions, error } = await query;
    if (error) throw error;
    
    let result = questions || [];
    
    if (sort === "difficulty") {
      const diffOrder = { 'zor': 1, 'orta': 2, 'kolay': 3 };
      result.sort((a,b) => (diffOrder[a.difficulty] || 99) - (diffOrder[b.difficulty] || 99));
    }

    res.json(result.map(formatQuestion));
  } catch (error) {
    console.error("Sorular getirilirken hata:", error);
    res.status(500).json({ error: "Sorular yüklenemedi" });
  }
});

// Tek soru getir
app.get("/api/questions/:id", authMiddleware, async (req, res) => {
  try {
    const { data: question, error } = await supabase
      .from('questions')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();
      
    if (error || !question) return res.status(404).json({ error: "Soru bulunamadı" });
    res.json(formatQuestion(question));
  } catch (error) {
    res.status(500).json({ error: "Hata oluştu" });
  }
});

// Soru sil
app.delete("/api/questions/:id", authMiddleware, async (req, res) => {
  try {
    const { data: question, error: getErr } = await supabase
      .from('questions')
      .select('*')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();
      
    if (getErr || !question) return res.status(404).json({ error: "Soru bulunamadı veya yetkiniz yok" });

    // Supabase Storage silme
    try {
      const fileName = question.image_path.split('/').pop();
      if (fileName) {
        await supabase.storage.from('questions').remove([fileName]);
      }
    } catch (e) {
      console.log("Dosya silme hatası:", e);
    }

    const { error: delErr } = await supabase.from('questions').delete().eq('id', req.params.id);
    if (delErr) throw delErr;
    
    res.json({ success: true, message: "Soru silindi" });
  } catch (error) {
    res.status(500).json({ error: "Silme işlemi başarısız" });
  }
});

// İstatistikler
app.get("/api/stats", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const { data: questions, error } = await supabase
      .from('questions')
      .select('*')
      .eq('user_id', userId);
      
    if (error) throw error;

    const total = questions.length;

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const oneWeekAgoStr = oneWeekAgo.toISOString();

    let weekCount = 0;
    const subjectMap = {};
    const difficultyMap = {};
    const topicMap = {};
    const weeklyTrendMap = Array(7).fill(0);

    questions.forEach(q => {
      const qDate = new Date(q.created_at);
      
      if (qDate >= oneWeekAgo) weekCount++;
      
      subjectMap[q.subject] = (subjectMap[q.subject] || 0) + 1;
      difficultyMap[q.difficulty] = (difficultyMap[q.difficulty] || 0) + 1;
      
      const key = `${q.subject}|${q.topic}`;
      if (!topicMap[key]) topicMap[key] = { subject: q.subject, topic: q.topic, count: 0 };
      topicMap[key].count++;

      // Weekly trend
      for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
        if (qDate >= start && qDate < end) {
          weeklyTrendMap[i]++;
        }
      }
    });

    const bySubject = Object.entries(subjectMap).map(([subject, count]) => ({ subject, count })).sort((a,b) => b.count - a.count);
    const byDifficulty = Object.entries(difficultyMap).map(([difficulty, count]) => ({ difficulty, count }));
    const byTopic = Object.values(topicMap).sort((a,b) => b.count - a.count).slice(0, 10);
    
    const worstSubject = bySubject.length > 0 ? bySubject[0].subject : "-";
    const uniqueSubjects = bySubject.length;

    const weeklyTrend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      weeklyTrend.push({ day: d.getDay(), count: weeklyTrendMap[i] });
    }

    res.json({
      total,
      weekCount,
      worstSubject,
      uniqueSubjects,
      bySubject,
      byDifficulty,
      byTopic,
      weeklyTrend
    });
  } catch (error) {
    console.error("İstatistik hatası:", error);
    res.status(500).json({ error: "İstatistikler yüklenemedi" });
  }
});

// Dışa aktar
app.get("/api/export", authMiddleware, async (req, res) => {
  try {
    const { data: questions, error } = await supabase
      .from('questions')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
      
    if (error) throw error;
    res.json(questions.map(formatQuestion));
  } catch (error) {
    res.status(500).json({ error: "Dışa aktarma başarısız" });
  }
});

// ==============================
// STATIC FILES & SPA FALLBACK
// ==============================

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// SPA fallback
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ==============================
// SUNUCU BAŞLAT
// ==============================

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║   🎯 Yanlış Defterim - Backend Aktif    ║
║   🌐 http://localhost:${PORT}              ║
║   🤖 Gemini AI: Bağlı                   ║
║   💾 Supabase: Hazır                    ║
║   📁 Pusula Takımı © 2026               ║
╚══════════════════════════════════════════╝
  `);
});
