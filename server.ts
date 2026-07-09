import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

const app = express();
const PORT = 3000;

// Set up limit for base64 image uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Database path
const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "db.json");

// Ensure DB directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// Default DB structure
interface Student {
  id: string;
  studentId: string;
  name: string;
  level: string;
  photo?: string; // base64 encoded profile photo
  registeredAt?: string;
}

interface Teacher {
  id: string;
  teacherId: string;
  name: string;
  photo?: string;
  password?: string;
  registeredAt?: string;
}

interface AttendanceLog {
  id: string;
  studentId: string;
  studentName: string;
  level: string;
  timestamp: string;
  status: "Present" | "Late" | "Absent" | "Excused";
  method: "Face Recognition" | "Manual";
  confidence?: number;
  photo?: string; // base64 photo captured during check-in
}

interface DB {
  students: Student[];
  teachers: Teacher[];
  logs: AttendanceLog[];
  settings: {
    googleSheetUrl: string;
    autoAttendance: boolean;
  };
}

const DEFAULT_DB: DB = {
  students: [
    {
      id: "std-1",
      studentId: "65301001",
      name: "นายสมศักดิ์ รักเรียน",
      level: "ปวส. 1/1 แผนกเทคโนโลยีสารสนเทศ",
      registeredAt: "2026-07-08T10:00:00.000Z"
    },
    {
      id: "std-2",
      studentId: "65301002",
      name: "นางสาวสมหญิง นามสมมุติ",
      level: "ปวส. 1/1 แผนกเทคโนโลยีสารสนเทศ",
      registeredAt: "2026-07-08T11:30:00.000Z"
    }
  ],
  teachers: [
    {
      id: "tch-1",
      teacherId: "teacher1",
      name: "อาจารย์จรัส แสงดี",
      password: "password123",
      registeredAt: "2026-07-08T09:00:00.000Z"
    }
  ],
  logs: [],
  settings: {
    googleSheetUrl: "",
    autoAttendance: true
  }
};

// Read database
function readDB(): DB {
  try {
    if (fs.existsSync(DB_PATH)) {
      const data = fs.readFileSync(DB_PATH, "utf-8");
      return JSON.parse(data);
    }
  } catch (error) {
    console.error("Error reading database file:", error);
  }
  
  // If file doesn't exist or is corrupted, write and return default
  writeDB(DEFAULT_DB);
  return DEFAULT_DB;
}

// Write database
function writeDB(data: DB) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error("Error writing database file:", error);
  }
}

// Lazy Gemini API Client Initialization
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY_MISSING: ไม่พบคีย์ลับ API (GEMINI_API_KEY) ในระบบ กรุณาเพิ่มคีย์ความปลอดภัยของคุณใน Settings > Secrets ของ AI Studio");
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// ----------------------------------------
// API ENDPOINTS
// ----------------------------------------

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Get configurations
app.get("/api/config", (req, res) => {
  const db = readDB();
  res.json({ settings: db.settings });
});

// Save configuration
app.post("/api/config", (req, res) => {
  const { googleSheetUrl, autoAttendance } = req.body;
  const db = readDB();
  db.settings = {
    googleSheetUrl: googleSheetUrl ?? db.settings.googleSheetUrl,
    autoAttendance: autoAttendance ?? db.settings.autoAttendance
  };
  writeDB(db);
  res.json({ success: true, settings: db.settings });
});

// Get list of students
app.get("/api/students", (req, res) => {
  const db = readDB();
  res.json(db.students);
});

// Get a single student
app.get("/api/students/:id", (req, res) => {
  const db = readDB();
  const student = db.students.find(s => s.id === req.params.id || s.studentId === req.params.id);
  if (!student) {
    return res.status(404).json({ error: "ไม่พบข้อมูลนักเรียน" });
  }
  res.json(student);
});

// Add / Update student (Teachers/Admins)
app.post("/api/students", (req, res) => {
  const { studentId, name, level, photo } = req.body;
  if (!studentId || !name || !level) {
    return res.status(400).json({ error: "กรุณากรอกข้อมูลให้ครบถ้วน (รหัสนักเรียน, ชื่อ-นามสกุล, ระดับชั้น)" });
  }

  const db = readDB();
  
  // Check if studentId already exists
  const existingIndex = db.students.findIndex(s => s.studentId === studentId);
  
  if (existingIndex > -1) {
    // Update existing student
    db.students[existingIndex] = {
      ...db.students[existingIndex],
      name,
      level,
      photo: photo ?? db.students[existingIndex].photo,
      registeredAt: photo ? new Date().toISOString() : db.students[existingIndex].registeredAt
    };
    writeDB(db);
    return res.json({ success: true, message: "อัปเดตข้อมูลนักเรียนเรียบร้อย", student: db.students[existingIndex] });
  } else {
    // Create new student
    const newStudent: Student = {
      id: "std_" + Date.now(),
      studentId,
      name,
      level,
      photo,
      registeredAt: photo ? new Date().toISOString() : undefined
    };
    db.students.push(newStudent);
    writeDB(db);
    return res.status(201).json({ success: true, message: "เพิ่มข้อมูลนักเรียนเรียบร้อย", student: newStudent });
  }
});

// Student Facial Registration
app.post("/api/students/register-face", (req, res) => {
  const { studentId, photo } = req.body;
  if (!studentId || !photo) {
    return res.status(400).json({ error: "กรุณาระบุรหัสนักศึกษาและภาพถ่ายเพื่อลงทะเบียน" });
  }

  const db = readDB();
  const studentIndex = db.students.findIndex(s => s.studentId === studentId);
  
  if (studentIndex === -1) {
    return res.status(404).json({ error: "ไม่พบรหัสนักศึกษานี้ในระบบ กรุณาตรวจสอบรหัสนักศึกษาอีกครั้ง หรือให้คุณครูเพิ่มรายชื่อของคุณก่อน" });
  }

  db.students[studentIndex].photo = photo;
  db.students[studentIndex].registeredAt = new Date().toISOString();
  writeDB(db);

  res.json({ 
    success: true, 
    message: "ลงทะเบียนใบหน้าสำเร็จ!", 
    student: {
      studentId: db.students[studentIndex].studentId,
      name: db.students[studentIndex].name,
      level: db.students[studentIndex].level
    }
  });
});

// Delete student (Teachers/Admins)
app.delete("/api/students/:id", (req, res) => {
  const db = readDB();
  const initialLength = db.students.length;
  db.students = db.students.filter(s => s.id !== req.params.id && s.studentId !== req.params.id);
  
  if (db.students.length === initialLength) {
    return res.status(404).json({ error: "ไม่พบข้อมูลนักเรียน" });
  }
  
  writeDB(db);
  res.json({ success: true, message: "ลบข้อมูลนักเรียนเรียบร้อย" });
});

// Import students from Google Sheet
app.post("/api/sheets/import", async (req, res) => {
  const { googleSheetUrl } = req.body;
  if (!googleSheetUrl) {
    return res.status(400).json({ error: "กรุณาระบุลิงก์ Google Sheets" });
  }

  try {
    // Save URL to config
    const db = readDB();
    db.settings.googleSheetUrl = googleSheetUrl;
    writeDB(db);

    // Parse Google Sheets URL to get the direct CSV download link
    // Format: https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit...
    const spreadsheetIdMatch = googleSheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (!spreadsheetIdMatch) {
      return res.status(400).json({ error: "ลิงก์ Google Sheets ไม่ถูกต้อง กรุณาใช้ลิงก์ที่แชร์จากปุ่ม 'แชร์ (Share)'" });
    }

    const spreadsheetId = spreadsheetIdMatch[1];
    const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;

    const response = await fetch(csvUrl);
    if (!response.ok) {
      throw new Error("ไม่สามารถดาวน์โหลดไฟล์จาก Google Sheets ได้ กรุณาแชร์ชีตของคุณเป็น 'ทุกคนที่มีลิงก์มีสิทธิ์อ่าน' (Anyone with the link can view)");
    }

    const csvText = await response.text();
    
    // Parse CSV simple parser (supports Thai UTF-8, handles quotes and commas)
    const lines = csvText.split(/\r?\n/);
    if (lines.length <= 1) {
      return res.status(400).json({ error: "ไม่พบข้อมูลในไฟล์ หรือไฟล์ไม่มีข้อมูลของนักเรียน" });
    }

    // Attempt to parse columns
    // We expect columns representing: Student ID, Name, Level/Class
    // We can guess column index based on values or headers
    const importedStudents: Student[] = [];
    
    // Start parsing from line 1 (skip header line 0)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Split by comma but respect quotes
      const columns: string[] = [];
      let currentVal = "";
      let inQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          columns.push(currentVal.trim().replace(/^"|"$/g, ''));
          currentVal = "";
        } else {
          currentVal += char;
        }
      }
      columns.push(currentVal.trim().replace(/^"|"$/g, ''));

      if (columns.length >= 2) {
        // Find best assignments: 
        // Student ID: column with digits (usually first or second)
        // Name: column with letters
        // Class/Level: remaining column
        const studentId = columns[0] || "";
        const name = columns[1] || "";
        const level = columns[2] || "ไม่ระบุชั้นเรียน";

        if (studentId && name) {
          importedStudents.push({
            id: "std_imported_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
            studentId: studentId.trim(),
            name: name.trim(),
            level: level.trim()
          });
        }
      }
    }

    if (importedStudents.length === 0) {
      return res.status(400).json({ error: "ไม่สามารถแปลงข้อมูลนักเรียนได้ กรุณาตรวจเช็คคอลัมน์ใน Google Sheet (คอลัมน์แรก: รหัสนักเรียน, คอลัมน์สอง: ชื่อ-นามสกุล, คอลัมน์สาม: ชั้นเรียน)" });
    }

    // Merge with existing students: preserve registered photos for matching students
    const finalDb = readDB();
    let updatedCount = 0;
    let addedCount = 0;

    for (const imported of importedStudents) {
      const existingIdx = finalDb.students.findIndex(s => s.studentId === imported.studentId);
      if (existingIdx > -1) {
        // Update basic info but keep registered photo!
        finalDb.students[existingIdx].name = imported.name;
        finalDb.students[existingIdx].level = imported.level;
        updatedCount++;
      } else {
        finalDb.students.push(imported);
        addedCount++;
      }
    }

    writeDB(finalDb);

    res.json({
      success: true,
      message: `นำเข้าข้อมูลจาก Google Sheets สำเร็จ! เพิ่มนักเรียนใหม่ ${addedCount} คน, อัปเดตข้อมูลนักเรียนเดิม ${updatedCount} คน`,
      importedCount: importedStudents.length
    });

  } catch (err: any) {
    res.status(500).json({ error: err.message || "เกิดข้อผิดพลาดในการดึงข้อมูลจาก Google Sheet" });
  }
});

// Teachers API
app.get("/api/teachers", (req, res) => {
  const db = readDB();
  res.json(db.teachers.map(t => ({ id: t.id, teacherId: t.teacherId, name: t.name, photo: !!t.photo, registeredAt: t.registeredAt })));
});

// Register Teacher
app.post("/api/teachers", (req, res) => {
  const { teacherId, name, password, photo } = req.body;
  if (!teacherId || !name || !password) {
    return res.status(400).json({ error: "กรุณากรอกข้อมูลผู้ใช้ครูให้ครบถ้วน" });
  }

  const db = readDB();
  const existingIdx = db.teachers.findIndex(t => t.teacherId === teacherId);
  if (existingIdx > -1) {
    return res.status(400).json({ error: "รหัสผู้ใช้ครูนี้มีอยู่ในระบบแล้ว" });
  }

  const newTeacher: Teacher = {
    id: "tch_" + Date.now(),
    teacherId,
    name,
    password,
    photo,
    registeredAt: new Date().toISOString()
  };

  db.teachers.push(newTeacher);
  writeDB(db);

  res.json({ success: true, message: "ลงทะเบียนบัญชีครูเรียบร้อยแล้ว!" });
});

// Teacher & Student Face Recognition Login
app.post("/api/login-face", async (req, res) => {
  const { photo, role } = req.body; // role = 'teacher' | 'student'
  if (!photo || !role) {
    return res.status(400).json({ error: "กรุณาจัดเตรียมรูปภาพสำหรับวิเคราะห์และระบุบทบาทผู้ใช้" });
  }

  try {
    const db = readDB();
    const cleanPhoto = photo.replace(/^data:image\/\w+;base64,/, "");

    // 1. Get targets with photos to compare
    let targets: { id: string; name: string; studentId?: string; teacherId?: string; photo: string }[] = [];
    if (role === "teacher") {
      targets = db.teachers
        .filter(t => t.photo)
        .map(t => ({ id: t.id, name: t.name, teacherId: t.teacherId, photo: t.photo! }));
    } else {
      targets = db.students
        .filter(s => s.photo)
        .map(s => ({ id: s.id, name: s.name, studentId: s.studentId, photo: s.photo! }));
    }

    if (targets.length === 0) {
      return res.status(400).json({ 
        error: `ไม่มีประวัติตัวตนในระบบที่มีไฟล์รูปถ่ายใบหน้าสำหรับบทบาท ${role === "teacher" ? "ครู" : "นักเรียน"} กรุณาลงทะเบียนแบบธรรมดาและบันทึกใบหน้าก่อน` 
      });
    }

    // Call Gemini API to match the captured photo with the best candidate
    const ai = getGeminiClient();

    // To prevent sending all base64 photos to Gemini which can be very heavy,
    // let's create a visual comparison package with the top 3 registered candidates, or we can use Gemini to select the match.
    // Since we want standard, high-reliability face verification, we can do it by asking Gemini to evaluate who matches.
    // Let's create visual prompt parts:
    const liveImagePart = {
      inlineData: {
        mimeType: "image/jpeg",
        data: cleanPhoto
      }
    };

    // We'll package registered pictures
    const imageParts: any[] = [liveImagePart];
    
    // Create detailed prompt mapping candidates
    let candidateDescription = "";
    targets.forEach((target, index) => {
      candidateDescription += `Candidate [Index: ${index}, Name: ${target.name}, ID: ${target.studentId || target.teacherId}]\n`;
      // We encode each registered picture as an inlineData block
      const regClean = target.photo.replace(/^data:image\/\w+;base64,/, "");
      imageParts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: regClean
        }
      });
    });

    const promptText = `Task: Face recognition and identity verification.
You are given a "Live Camera Photo" (the first image) and a list of registered candidates (the remaining images in the exact index order).
Compare the face in the Live Camera Photo with each of the candidate images provided.

Here is the candidate registry in the exact order of the remaining images (Image 1 is live photo, Image 2 is Candidate 0, Image 3 is Candidate 1, etc.):
${candidateDescription}

Determine which registered candidate matches the person in the Live Camera Photo. 
If there is a match with a high degree of confidence (similarity > 75%), return that candidate's information.
If there are no matches, state that no match was found.

Respond strictly in JSON format matching this schema:
{
  "isMatch": boolean,
  "matchedIndex": number (or -1 if no match),
  "matchedId": "string" (studentId/teacherId or empty),
  "matchedName": "string" (or empty),
  "confidence": number (0 to 100),
  "reason": "short explanation in Thai"
}`;

    const textPart = { text: promptText };
    const contents = { parts: [...imageParts.slice(0, 5), textPart] }; // Limit to top 4 candidates for token limits and speed

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isMatch: { type: Type.BOOLEAN },
            matchedIndex: { type: Type.INTEGER },
            matchedId: { type: Type.STRING },
            matchedName: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
            reason: { type: Type.STRING }
          },
          required: ["isMatch", "matchedIndex", "matchedId", "matchedName", "confidence", "reason"]
        }
      }
    });

    const result = JSON.parse(response.text?.trim() || "{}");
    
    if (result.isMatch && result.matchedIndex >= 0 && result.matchedIndex < targets.length) {
      const match = targets[result.matchedIndex];
      // Authenticate
      res.json({
        success: true,
        user: {
          role,
          id: match.id,
          username: match.studentId || match.teacherId,
          name: match.name,
          level: (match as any).level || undefined
        },
        confidence: result.confidence,
        reason: result.reason
      });
    } else {
      res.status(401).json({ 
        error: "สแกนใบหน้าล้มเหลว: ใบหน้าไม่ตรงกับผู้ใดในระบบระบบรักษาความปลอดภัย",
        confidence: result.confidence || 0,
        reason: result.reason || "ไม่พบใบหน้าที่ตรงกัน"
      });
    }

  } catch (err: any) {
    console.error("Face login error:", err);
    res.status(500).json({ error: err.message || "เกิดข้อผิดพลาดระหว่างสแกนใบหน้าเพื่อเข้าสู่ระบบ" });
  }
});

// Teacher Classic Login
app.post("/api/login-classic", (req, res) => {
  const { teacherId, password } = req.body;
  if (!teacherId || !password) {
    return res.status(400).json({ error: "กรุณากรอกรหัสผู้ใช้และรหัสผ่าน" });
  }

  // Admin login check (specified: ID = admin, Password = 44120)
  if (teacherId === "admin" && password === "44120") {
    return res.json({
      success: true,
      user: {
        role: "admin",
        id: "admin",
        username: "admin",
        name: "ผู้ดูแลระบบสูงสุด (Super Admin)"
      }
    });
  }

  const db = readDB();
  const teacher = db.teachers.find(t => t.teacherId === teacherId);
  if (!teacher || teacher.password !== password) {
    return res.status(401).json({ error: "รหัสผู้ใช้ครูหรือรหัสผ่านไม่ถูกต้อง" });
  }

  res.json({
    success: true,
    user: {
      role: "teacher",
      id: teacher.id,
      username: teacher.teacherId,
      name: teacher.name
    }
  });
});

// Face Match Attendance Check (Real-time check-in by student webcam)
app.post("/api/attendance/check-in", async (req, res) => {
  const { photo, studentId } = req.body; // studentId is optional. If provided, we compare directly. If not, we scan registry!
  if (!photo) {
    return res.status(400).json({ error: "กรุณาถ่ายภาพเพื่อเช็คชื่อเข้าเรียน" });
  }

  try {
    const db = readDB();
    const cleanPhoto = photo.replace(/^data:image\/\w+;base64,/, "");

    let targetStudents: Student[] = [];
    
    if (studentId) {
      // Find exact student
      const matched = db.students.find(s => s.studentId === studentId);
      if (!matched) {
        return res.status(404).json({ error: "ไม่พบข้อมูลรหัสนักเรียนนี้ในฐานข้อมูล" });
      }
      if (!matched.photo) {
        return res.status(400).json({ error: "นักเรียนคนนี้ยังไม่ได้ลงทะเบียนใบหน้าในระบบ กรุณาลงทะเบียนใบหน้าก่อน" });
      }
      targetStudents = [matched];
    } else {
      // Find all students with registered photos to scan entire classroom!
      targetStudents = db.students.filter(s => s.photo);
    }

    if (targetStudents.length === 0) {
      return res.status(400).json({ error: "ไม่มีรายชื่อนักศึกษาที่ลงทะเบียนใบหน้าในระบบเลย กรุณาแจ้งนักเรียนมาลงทะเบียนใบหน้าก่อน" });
    }

    // Initialize Gemini to compare
    const ai = getGeminiClient();

    // Prepare image payload
    const liveImagePart = {
      inlineData: {
        mimeType: "image/jpeg",
        data: cleanPhoto
      }
    };

    const imageParts: any[] = [liveImagePart];
    let candidateDescription = "";
    
    // Limit to top 5 candidates for reliable processing per single API request
    const evaluatedStudents = targetStudents.slice(0, 5);
    
    evaluatedStudents.forEach((student, index) => {
      candidateDescription += `Student [Index: ${index}, Name: ${student.name}, StudentID: ${student.studentId}]\n`;
      const regClean = student.photo!.replace(/^data:image\/\w+;base64,/, "");
      imageParts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: regClean
        }
      });
    });

    const promptText = `Task: Facial Recognition Attendance System.
Compare the live captured face (first image) against the registered student registry images (remaining images in the exact index order).

Student registry mapping:
${candidateDescription}

Does the live capture match any registered student image?
We need high similarity verification (> 75%) to prevent security bypasses.
If a match is found, verify which index it is. If no matches exist, set isMatch: false.

Provide your evaluation in Thai and reply strictly in JSON format matching this schema:
{
  "isMatch": boolean,
  "matchedIndex": number (or -1),
  "studentId": "string" (studentId or empty),
  "studentName": "string" (or empty),
  "confidence": number (0 to 100),
  "reason": "short explanation in Thai about similarity matching"
}`;

    const textPart = { text: promptText };
    const contents = { parts: [...imageParts, textPart] };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isMatch: { type: Type.BOOLEAN },
            matchedIndex: { type: Type.INTEGER },
            studentId: { type: Type.STRING },
            studentName: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
            reason: { type: Type.STRING }
          },
          required: ["isMatch", "matchedIndex", "studentId", "studentName", "confidence", "reason"]
        }
      }
    });

    const result = JSON.parse(response.text?.trim() || "{}");

    if (result.isMatch && result.matchedIndex >= 0 && result.matchedIndex < evaluatedStudents.length) {
      const student = evaluatedStudents[result.matchedIndex];
      
      // Calculate attendance status based on current local time
      // Class start time can be 08:30 AM. Current local time check:
      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      
      let status: "Present" | "Late" | "Absent" | "Excused" = "Present";
      
      // If time is past 08:45 AM, mark as Late
      if (currentHours > 8 || (currentHours === 8 && currentMinutes > 45)) {
        status = "Late";
      }

      // Add Attendance Log
      const logEntry: AttendanceLog = {
        id: "log_" + Date.now(),
        studentId: student.studentId,
        studentName: student.name,
        level: student.level,
        timestamp: now.toISOString(),
        status,
        method: "Face Recognition",
        confidence: result.confidence,
        photo: photo // Save verification capture
      };

      const updatedDb = readDB();
      updatedDb.logs.push(logEntry);
      writeDB(updatedDb);

      return res.json({
        success: true,
        message: `เช็คชื่อสำเร็จ: ${student.name}`,
        student: {
          studentId: student.studentId,
          name: student.name,
          level: student.level
        },
        log: logEntry,
        confidence: result.confidence,
        reason: result.reason
      });
    } else {
      return res.status(401).json({
        error: "ไม่พบประวัติใบหน้าที่ตรงกันในระบบ กรุณาลองจัดมุมกล้องใหม่ หรือติดต่อคุณครูเพื่อลงทะเบียนใบหน้า",
        confidence: result.confidence || 0,
        reason: result.reason || "ไม่สามารถวิเคราะห์หาคู่ใบหน้าที่ตรงกันได้"
      });
    }

  } catch (err: any) {
    console.error("Attendance API error:", err);
    res.status(500).json({ error: err.message || "เกิดข้อผิดพลาดในการประมวลผลเช็คชื่อด้วยใบหน้า" });
  }
});

// Manual Attendance Log Submission (Teachers/Admins)
app.post("/api/attendance/manual", (req, res) => {
  const { studentId, status } = req.body;
  if (!studentId || !status) {
    return res.status(400).json({ error: "กรุณากรอกข้อมูลรหัสและสถานะการเข้าเรียน" });
  }

  const db = readDB();
  const student = db.students.find(s => s.studentId === studentId);
  if (!student) {
    return res.status(404).json({ error: "ไม่พบข้อมูลนักเรียน" });
  }

  const newLog: AttendanceLog = {
    id: "log_" + Date.now(),
    studentId: student.studentId,
    studentName: student.name,
    level: student.level,
    timestamp: new Date().toISOString(),
    status,
    method: "Manual"
  };

  db.logs.push(newLog);
  writeDB(db);

  res.json({ success: true, message: "บันทึกการเช็คชื่อแบบปกติสำเร็จ", log: newLog });
});

// Get Attendance Logs
app.get("/api/logs", (req, res) => {
  const db = readDB();
  res.json(db.logs);
});

// Clear Logs
app.delete("/api/logs", (req, res) => {
  const db = readDB();
  db.logs = [];
  writeDB(db);
  res.json({ success: true, message: "เคลียร์ประวัติการเช็คชื่อทั้งหมดแล้ว" });
});

// ----------------------------------------
// VITE DEV SERVER / PRODUCTION SERVING
// ----------------------------------------

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
