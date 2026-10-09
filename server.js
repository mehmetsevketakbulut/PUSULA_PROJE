/**
 * Yanlış Defterim - Backend Server
 * Express.js + SQLite + Gemini AI
 * Pusula Takımı © 2026
 */

const express = require("express");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const Database = require("better-sqlite3");

// ==============================
// YAPILANDIRMA
// ==============================

const app = express();
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "YOUR_API_KEY";

// Gemini AI
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-3.8-flash" });

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.static(path.join(__dirname, "public")));

// Multer (dosya yükleme)
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "uploads");
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `soru_${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Sadece resim dosyaları yüklenebilir!"));
  }
});

// Uploads klasörünü statik serve et
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ==============================
// VERİTABANI
// ==============================

const db = new Database(path.join(__dirname, "yanlis_defterim.db"));

// WAL mode (daha hızlı)
db.pragma("journal_mode = WAL");

// Tablo oluştur
db.exec(`
  CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    image_path TEXT NOT NULL,
    subject TEXT NOT NULL,
    topic TEXT DEFAULT '',
    difficulty TEXT DEFAULT 'orta',
    notes TEXT DEFAULT '',
    tags TEXT DEFAULT '[]',
    ai_solution TEXT DEFAULT '',
    ai_topic TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

console.log("✅ Veritabanı hazır");

// ==============================
// GEMİNİ AI ANALİZ
// ==============================

async function analyzeQuestion(imagePath, subject) {
  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString("base64");
    const mimeType = imagePath.endsWith(".png") ? "image/png" : "image/jpeg";

    const prompt = `Sen bir YKS (Yükseköğretim Kurumları Sınavı) uzmanısın. 
Sana bir soru görseli ve dersi veriyorum.

Ders: ${subject}

Görevlerin:
1. Bu sorunun hangi KONUYA ait olduğunu tespit et (örneğin Matematik ise: Türev, İntegral, Limit, vb.)
2. Sorunun adım adım ÇÖZÜMÜNÜ yaz

Yanıtını MUTLAKA şu JSON formatında ver, başka hiçbir şey yazma:
{
  "konu": "tespit ettiğin konu adı",
  "cozum": "adım adım çözüm (markdown formatında)"
}

Eğer görselden soru okunamıyorsa:
{
  "konu": "Belirlenemedi",
  "cozum": "Görsel net değil, lütfen daha net bir fotoğraf yükleyin."
}`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          mimeType,
          data: base64Image
        }
      }
    ]);

    const responseText = result.response.text();
    
    // JSON parse (bazen ```json ... ``` ile sarabilir)
    let cleaned = responseText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    
    return {
      topic: parsed.konu || "Belirlenemedi",
      solution: parsed.cozum || "Çözüm üretilemedi"
    };
  } catch (error) {
    console.error("Gemini API hatası:", error.message);
    return {
      topic: "Belirlenemedi",
      solution: "Yapay zeka analizi sırasında bir hata oluştu. Lütfen tekrar deneyin."
    };
  }
}

// ==============================
// API ENDPOINT'LERİ
// ==============================

// Yeni soru ekle (fotoğraf + AI analiz)
app.post("/api/questions", upload.single("image"), async (req, res) => {
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
    const aiResult = await analyzeQuestion(req.file.path, subject);
    console.log(`✅ AI analiz tamamlandı - Konu: ${aiResult.topic}`);

    // Veritabanına kaydet
    const stmt = db.prepare(`
      INSERT INTO questions (image_path, subject, topic, difficulty, notes, tags, ai_solution, ai_topic)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      `/uploads/${req.file.filename}`,
      subject,
      aiResult.topic,
      difficulty || "orta",
      notes || "",
      tags || "[]",
      aiResult.solution,
      aiResult.topic
    );

    const question = db.prepare("SELECT * FROM questions WHERE id = ?").get(result.lastInsertRowid);

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
app.get("/api/questions", (req, res) => {
  try {
    const { subject, topic, difficulty, search, sort } = req.query;

    let sql = "SELECT * FROM questions WHERE 1=1";
    const params = [];

    if (subject) { sql += " AND subject = ?"; params.push(subject); }
    if (topic) { sql += " AND topic = ?"; params.push(topic); }
    if (difficulty) { sql += " AND difficulty = ?"; params.push(difficulty); }
    if (search) {
      sql += " AND (notes LIKE ? OR tags LIKE ? OR topic LIKE ?)";
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    // Sıralama
    switch (sort) {
      case "date-asc": sql += " ORDER BY created_at ASC"; break;
      case "subject": sql += " ORDER BY subject ASC"; break;
      case "difficulty":
        sql += " ORDER BY CASE difficulty WHEN 'zor' THEN 1 WHEN 'orta' THEN 2 WHEN 'kolay' THEN 3 END";
        break;
      default: sql += " ORDER BY created_at DESC";
    }

    const questions = db.prepare(sql).all(...params);
    res.json(questions.map(formatQuestion));
  } catch (error) {
    console.error("Sorular getirilirken hata:", error);
    res.status(500).json({ error: "Sorular yüklenemedi" });
  }
});

// Tek soru getir
app.get("/api/questions/:id", (req, res) => {
  try {
    const question = db.prepare("SELECT * FROM questions WHERE id = ?").get(req.params.id);
    if (!question) return res.status(404).json({ error: "Soru bulunamadı" });
    res.json(formatQuestion(question));
  } catch (error) {
    res.status(500).json({ error: "Hata oluştu" });
  }
});

// Soru sil
app.delete("/api/questions/:id", (req, res) => {
  try {
    const question = db.prepare("SELECT * FROM questions WHERE id = ?").get(req.params.id);
    if (!question) return res.status(404).json({ error: "Soru bulunamadı" });

    // Dosyayı sil
    const filePath = path.join(__dirname, question.image_path);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    db.prepare("DELETE FROM questions WHERE id = ?").run(req.params.id);
    res.json({ success: true, message: "Soru silindi" });
  } catch (error) {
    res.status(500).json({ error: "Silme işlemi başarısız" });
  }
});

// İstatistikler
app.get("/api/stats", (req, res) => {
  try {
    const total = db.prepare("SELECT COUNT(*) as count FROM questions").get().count;

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weekCount = db.prepare(
      "SELECT COUNT(*) as count FROM questions WHERE created_at >= ?"
    ).get(oneWeekAgo.toISOString()).count;

    const bySubject = db.prepare(
      "SELECT subject, COUNT(*) as count FROM questions GROUP BY subject ORDER BY count DESC"
    ).all();

    const byDifficulty = db.prepare(
      "SELECT difficulty, COUNT(*) as count FROM questions GROUP BY difficulty"
    ).all();

    const byTopic = db.prepare(
      "SELECT subject, topic, COUNT(*) as count FROM questions GROUP BY subject, topic ORDER BY count DESC LIMIT 10"
    ).all();

    const worstSubject = bySubject.length > 0 ? bySubject[0].subject : "-";
    const uniqueSubjects = bySubject.length;

    // Haftalık trend (son 7 gün)
    const weeklyTrend = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
      const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).toISOString();
      const count = db.prepare(
        "SELECT COUNT(*) as count FROM questions WHERE created_at >= ? AND created_at < ?"
      ).get(dayStart, dayEnd).count;
      weeklyTrend.push({ day: d.getDay(), count });
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
app.get("/api/export", (req, res) => {
  try {
    const questions = db.prepare("SELECT * FROM questions ORDER BY created_at DESC").all();
    res.json(questions.map(formatQuestion));
  } catch (error) {
    res.status(500).json({ error: "Dışa aktarma başarısız" });
  }
});

// ==============================
// YARDIMCI
// ==============================

function formatQuestion(q) {
  let tags = [];
  try { tags = JSON.parse(q.tags); } catch (e) { tags = []; }
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
    dateAdded: q.created_at
  };
}

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
║   💾 SQLite: Hazır                       ║
║   📁 Pusula Takımı © 2026               ║
╚══════════════════════════════════════════╝
  `);
});
