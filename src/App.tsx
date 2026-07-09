import React, { useState, useEffect } from "react";
import { Student, Teacher, AttendanceLog, Settings, AppView } from "./types";
import CameraCapture from "./components/CameraCapture";
import TeacherDashboard from "./components/TeacherDashboard";
import AdminPanel from "./components/AdminPanel";
import { 
  Scan, UserRound, LogIn, Award, Sparkles, BookOpen, Clock, 
  ShieldCheck, HelpCircle, Lock, Users, LogOut, CheckCircle, 
  XCircle, AlertTriangle, Key, ArrowRight, UserPlus
} from "lucide-react";

export default function App() {
  const [view, setView] = useState<AppView>("check-in");
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [settings, setSettings] = useState<Settings>({ googleSheetUrl: "", autoAttendance: true });

  // Loading States
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isProcessingAttendance, setIsProcessingAttendance] = useState(false);

  // Authentication Session
  const [user, setUser] = useState<{ role: "teacher" | "admin"; id: string; username: string; name: string } | null>(null);
  
  // Login Inputs
  const [loginId, setLoginId] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginWithFaceActive, setLoginWithFaceActive] = useState(false);

  // Registration states
  const [regStudentId, setRegStudentId] = useState("");
  const [matchedRegStudent, setMatchedRegStudent] = useState<Student | null>(null);
  const [regError, setRegError] = useState("");
  const [regSuccess, setRegSuccess] = useState("");
  const [isRegisteringFace, setIsRegisteringFace] = useState(false);

  // Check-In result HUD state
  const [checkInResult, setCheckInResult] = useState<{
    success: boolean;
    studentName?: string;
    studentId?: string;
    level?: string;
    message?: string;
    confidence?: number;
    reason?: string;
  } | null>(null);

  // Direct check-in student ID lock (Highly Recommended for accurate 1:1 match)
  const [checkInIdLock, setCheckInIdLock] = useState("");

  // Fetch initial data
  const fetchData = async () => {
    try {
      setIsLoadingStudents(true);
      // Students
      const stdRes = await fetch("/api/students");
      if (stdRes.ok) {
        const stdData = await stdRes.json();
        setStudents(stdData);
      }
      // Settings
      const confRes = await fetch("/api/config");
      if (confRes.ok) {
        const confData = await confRes.json();
        setSettings(confData.settings);
      }
      // Logs
      const logsRes = await fetch("/api/logs");
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setLogs(logsData);
      }
      // Teachers
      const teachersRes = await fetch("/api/teachers");
      if (teachersRes.ok) {
        const teachersData = await teachersRes.json();
        setTeachers(teachersData);
      }
    } catch (error) {
      console.error("Error loading startup data:", error);
    } finally {
      setIsLoadingStudents(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Sync data automatically every 30 seconds to keep live dashboard updated
  useEffect(() => {
    const timer = setInterval(() => {
      fetchData();
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  // ----------------------------------------
  // ACTIONS / HANDLERS
  // ----------------------------------------

  // Handle student lookup during face registration
  const handleLookupStudentReg = () => {
    setRegError("");
    setRegSuccess("");
    setMatchedRegStudent(null);
    
    if (!regStudentId.trim()) {
      setRegError("กรุณาระบุรหัสนักศึกษา");
      return;
    }

    const found = students.find(s => s.studentId === regStudentId.trim());
    if (!found) {
      setRegError("ไม่พบรหัสนักศึกษานี้ในฐานข้อมูล คุณครูต้องระบุรายชื่อนักเรียนก่อน จึงจะสามารถแสกนลงทะเบียนใบหน้าได้");
      return;
    }

    setMatchedRegStudent(found);
  };

  // Submit base64 photo for registration
  const handleFaceRegistration = async (base64Image: string) => {
    if (!matchedRegStudent) return;
    setIsRegisteringFace(true);
    setRegError("");
    setRegSuccess("");

    try {
      const response = await fetch("/api/students/register-face", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: matchedRegStudent.studentId,
          photo: base64Image
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "ไม่สามารถลงทะเบียนใบหน้าได้");
      }

      setRegSuccess(`ลงทะเบียนใบหน้าของ "${matchedRegStudent.name}" เรียบร้อยแล้ว! สามารถเช็คชื่อด้วยใบหน้าได้ทันที`);
      setRegStudentId("");
      setMatchedRegStudent(null);
      fetchData(); // Refresh list to update photo statuses
    } catch (err: any) {
      setRegError(err.message || "เกิดข้อผิดพลาดในการลงทะเบียน");
    } finally {
      setIsRegisteringFace(false);
    }
  };

  // Student Attendance Facial Check-in Capture
  const handleAttendanceCheckIn = async (base64Image: string) => {
    setIsProcessingAttendance(true);
    setCheckInResult(null);

    try {
      const response = await fetch("/api/attendance/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photo: base64Image,
          studentId: checkInIdLock.trim() || undefined
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        setCheckInResult({
          success: false,
          message: result.error || "ไม่พบใบหน้าที่ตรงกันในระบบรักษาความปลอดภัย"
        });
        return;
      }

      setCheckInResult({
        success: true,
        studentName: result.student.name,
        studentId: result.student.studentId,
        level: result.student.level,
        message: result.log.status === "Present" ? "เช็คชื่อสำเร็จ: เข้าเรียนตรงเวลา" : "เช็คชื่อสำเร็จ: เข้าเรียนสาย",
        confidence: result.confidence,
        reason: result.reason
      });

      // Clear lock and refresh logs
      setCheckInIdLock("");
      fetchData();
    } catch (err: any) {
      setCheckInResult({
        success: false,
        message: err.message || "เกิดข้อผิดพลาดในการเช็คชื่อ กรุณาลองใหม่อีกครั้ง"
      });
    } finally {
      setIsProcessingAttendance(false);
    }
  };

  // Classic password login
  const handleClassicLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    
    if (!loginId.trim() || !loginPassword.trim()) {
      setLoginError("กรุณากรอกรหัสผู้ใช้และรหัสผ่าน");
      return;
    }

    setIsLoggingIn(true);
    try {
      const response = await fetch("/api/login-classic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teacherId: loginId.trim(),
          password: loginPassword.trim()
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "เข้าสู่ระบบไม่สำเร็จ");
      }

      setUser(result.user);
      setLoginId("");
      setLoginPassword("");
    } catch (err: any) {
      setLoginError(err.message || "รหัสผ่านไม่ถูกต้อง");
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Facial login for teachers
  const handleFacialLogin = async (base64Image: string) => {
    setLoginError("");
    setIsLoggingIn(true);

    try {
      const response = await fetch("/api/login-face", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photo: base64Image,
          role: "teacher"
        })
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "ไม่พบสแกนใบหน้าที่ตรงกับครูท่านใดในระบบ");
      }

      setUser(result.user);
      setLoginWithFaceActive(false);
    } catch (err: any) {
      setLoginError(err.message || "สแกนใบหน้าล้มเหลว");
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Log out
  const handleLogout = () => {
    setUser(null);
  };

  // Backend calls proxied through props
  const handleAddStudentBackend = async (student: { studentId: string; name: string; level: string }) => {
    const res = await fetch("/api/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(student)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    fetchData();
  };

  const handleDeleteStudentBackend = async (id: string) => {
    const res = await fetch(`/api/students/${id}`, {
      method: "DELETE"
    });
    if (res.ok) {
      fetchData();
    }
  };

  const handleManualCheckInBackend = async (studentId: string, status: "Present" | "Late" | "Absent" | "Excused") => {
    const res = await fetch("/api/attendance/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, status })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    fetchData();
  };

  const handleImportFromSheetsBackend = async (url: string) => {
    const res = await fetch("/api/sheets/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ googleSheetUrl: url })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    alert(data.message);
    fetchData();
  };

  const handleRegisterTeacherBackend = async (teacher: any) => {
    const res = await fetch("/api/teachers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(teacher)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    fetchData();
  };

  const handleClearLogsBackend = async () => {
    const res = await fetch("/api/logs", {
      method: "DELETE"
    });
    if (res.ok) {
      fetchData();
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-slate-200 flex flex-col font-sans" id="app-root">
      
      {/* Dynamic Header */}
      <header className="border-b border-white/5 bg-[#050505]/90 backdrop-blur-md sticky top-0 z-40 px-4 py-4 md:py-5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {/* Logo Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-emerald-500 flex items-center justify-center text-black shadow-lg shadow-emerald-500/25 border border-emerald-400/20">
              <Scan className="w-5.5 h-5.5 animate-pulse" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span className="font-serif italic font-semibold text-lg tracking-wide">Student Face Attendance</span>
                <span className="text-[10px] bg-emerald-950/40 border border-emerald-900/30 text-emerald-400 font-mono px-1.5 py-0.5 rounded-md">
                  V1.2
                </span>
              </h1>
              <p className="text-xs text-slate-400 font-medium">ระบบเช็คชื่อนักเรียนด้วยใบหน้าอัจฉริยะ Gemini API</p>
            </div>
          </div>

          {/* Navigation Controls */}
          <nav className="flex items-center gap-1.5 bg-[#0a0a0a] border border-white/5 p-1 rounded-xl">
            <button
              id="tab-check-in-btn"
              onClick={() => { setView("check-in"); setCheckInResult(null); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition flex items-center gap-1.5 ${
                view === "check-in" 
                  ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/10" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              เช็คชื่อเข้าเรียน
            </button>

            <button
              id="tab-register-btn"
              onClick={() => { setView("register"); setRegError(""); setRegSuccess(""); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition flex items-center gap-1.5 ${
                view === "register" 
                  ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/10" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              ลงทะเบียนใบหน้า
            </button>

            <button
              id="tab-portal-btn"
              onClick={() => setView("portal")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition flex items-center gap-1.5 ${
                view === "portal" 
                  ? "bg-emerald-500 text-black shadow-md shadow-emerald-500/10" 
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              {user ? "แดชบอร์ดคุณครู" : "พอร์ทัลอาจารย์"}
            </button>
          </nav>
        </div>
      </header>

      {/* Main Container Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6">
        
        {/* ======================================== */}
        {/* VIEW 1: FACIAL ATTENDANCE CHECK-IN */}
        {/* ======================================== */}
        {view === "check-in" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start" id="view-check-in-pane">
            
            {/* Visual Camera Scanner Panel */}
            <div className="lg:col-span-1 space-y-5">
              <div className="bg-[#0a0a0a] border border-white/5 p-5 rounded-2xl shadow-xl flex flex-col items-center">
                <div className="text-center mb-4">
                  <span className="text-[10px] font-mono bg-emerald-950/45 text-emerald-400 border border-emerald-900/30 px-2 py-0.5 rounded-full font-semibold">
                    REALTIME FACIAL ATTENDANCE
                  </span>
                  <h2 className="text-base font-bold text-white mt-2 font-serif italic">สแกนใบหน้าเข้าเรียน</h2>
                  <p className="text-xs text-slate-400 mt-1">กรุณาวางใบหน้าของคุณให้อยู่ในกึ่งกลางกรอบกล้อง</p>
                </div>

                {/* Direct Match Lock Input (Highly Recommended) */}
                <div className="w-full mb-4 px-1">
                  <label className="block text-[10px] font-mono text-slate-500 mb-1">
                    รหัสนักศึกษา (ไม่บังคับ แต่ช่วยให้ระบุตัวตนถูกต้องยิ่งขึ้น)
                  </label>
                  <input
                    id="checkin-id-lock-input"
                    type="text"
                    placeholder="ระบุรหัสของคุณก่อนสแกน (เช่น 65301001)"
                    value={checkInIdLock}
                    onChange={(e) => setCheckInIdLock(e.target.value)}
                    className="w-full text-center bg-[#050505] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 placeholder-slate-700 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <CameraCapture 
                  onCapture={handleAttendanceCheckIn} 
                  isLoading={isProcessingAttendance} 
                  buttonText="สแกนใบหน้าและเช็คชื่อ"
                />
              </div>

              {/* Status information widget */}
              <div className="p-4 bg-[#0a0a0a]/40 border border-white/5 rounded-2xl flex gap-3 text-xs text-slate-400">
                <HelpCircle className="w-4.5 h-4.5 text-emerald-400 flex-shrink-0" />
                <div className="space-y-1 leading-relaxed">
                  <p className="font-semibold text-slate-300">ตารางกำหนดเวลาเข้าเรียน:</p>
                  <p>• มาเรียนตรงเวลา: สแกนใบหน้า ก่อน 08:45 น.</p>
                  <p>• สาย (Late): สแกนใบหน้า ตั้งแต่เวลา 08:45 น. เป็นต้นไป</p>
                  <p className="text-[11px] text-slate-500 font-serif italic">หมายเหตุ: ระบบวิเคราะห์โดยใช้ Gemini Vision API ตรวจหาตำแหน่งและเปรียบเทียบกับภาพโปรไฟล์ที่ลงทะเบียนไว้อย่างแม่นยำ</p>
                </div>
              </div>
            </div>

            {/* Attendance HUD Results and Live Logs */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Scan Results Board */}
              {checkInResult && (
                <div 
                  className={`p-6 rounded-2xl border flex flex-col md:flex-row items-center md:items-start gap-4 shadow-2xl animate-scaleUp ${
                    checkInResult.success 
                      ? "bg-emerald-950/20 border-emerald-500/40" 
                      : "bg-red-950/20 border-red-500/40"
                  }`}
                  id="scan-result-card"
                >
                  <div className={`p-3 rounded-2xl border ${
                    checkInResult.success ? "bg-emerald-950/80 text-emerald-400 border-emerald-900/50" : "bg-red-950/80 text-red-400 border-red-900/50"
                  }`}>
                    {checkInResult.success ? <CheckCircle className="w-7 h-7" /> : <XCircle className="w-7 h-7" />}
                  </div>

                  <div className="flex-1 space-y-2.5 text-center md:text-left">
                    <div>
                      <span className={`text-[10px] font-mono px-2.5 py-0.5 rounded-full border ${
                        checkInResult.success ? "bg-emerald-950 text-emerald-400 border-emerald-900/50" : "bg-red-950 text-red-400 border-red-900/50"
                      }`}>
                        {checkInResult.success ? "VERIFIED SUCCESS" : "VERIFICATION FAILED"}
                      </span>
                      <h3 className="text-lg font-bold text-neutral-100 mt-2">{checkInResult.message}</h3>
                    </div>

                    {checkInResult.success && (
                      <div className="bg-black/60 border border-white/5 p-4 rounded-xl space-y-1.5 text-sm">
                        <div className="flex justify-between border-b border-white/5 pb-1">
                          <span className="text-slate-500">ชื่อนักเรียน:</span>
                          <span className="font-semibold text-slate-200">{checkInResult.studentName}</span>
                        </div>
                        <div className="flex justify-between border-b border-white/5 pb-1">
                          <span className="text-slate-500">รหัสนักศึกษา:</span>
                          <span className="font-mono text-emerald-400 font-semibold">{checkInResult.studentId}</span>
                        </div>
                        <div className="flex justify-between border-b border-white/5 pb-1">
                          <span className="text-slate-500">ระดับชั้น:</span>
                          <span className="text-slate-300">{checkInResult.level}</span>
                        </div>
                        {checkInResult.confidence && (
                          <div className="flex justify-between pt-0.5">
                            <span className="text-slate-500">ความแม่นยำใบหน้า:</span>
                            <span className="font-mono font-bold text-emerald-400">{checkInResult.confidence}%</span>
                          </div>
                        )}
                      </div>
                    )}

                    {checkInResult.reason && (
                      <p className="text-xs text-slate-400 leading-relaxed italic bg-black/40 p-2.5 border border-white/5 rounded-lg">
                        คำวิเคราะห์: {checkInResult.reason}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Real-time Attendance Activity stream */}
              <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
                <div className="p-5 border-b border-white/5 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-white font-serif italic">ประวัติบันทึกการเช็คชื่อผู้เรียน (Live Stream)</h3>
                    <p className="text-xs text-slate-400 mt-1">ประวัติการสแกนใบหน้าเข้าชั้นเรียนวันนี้</p>
                  </div>
                  <span className="text-xs font-mono text-slate-300 bg-[#050505] px-2.5 py-1 rounded-lg border border-white/5">
                    ทั้งหมด {logs.length} รายการ
                  </span>
                </div>

                <div className="divide-y divide-white/5 max-h-[360px] overflow-y-auto">
                  {logs.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 text-sm space-y-1.5">
                      <Clock className="w-8 h-8 mx-auto text-slate-700" />
                      <p>ยังไม่มีข้อมูลผู้มาลงชื่อเข้าเรียนในวันนี้</p>
                    </div>
                  ) : (
                    logs.slice().reverse().map((log) => (
                      <div key={log.id} className="p-4 hover:bg-white/[0.02] transition flex items-center justify-between text-xs md:text-sm">
                        <div className="flex items-center gap-3">
                          {log.photo ? (
                            <div className="w-10 h-10 rounded-lg overflow-hidden border border-white/5">
                              <img src={log.photo} alt="Student" className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-[#050505] border border-white/10 flex items-center justify-center text-slate-500 font-bold">
                              {log.studentName.charAt(0)}
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-slate-200">{log.studentName}</div>
                            <div className="text-xs text-slate-400 mt-0.5">รหัส: {log.studentId} | {log.level}</div>
                          </div>
                        </div>

                        <div className="text-right space-y-1">
                          <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            log.status === "Present" 
                              ? "text-emerald-400 bg-emerald-950/40 border border-emerald-900/30" 
                              : log.status === "Late"
                              ? "text-amber-400 bg-amber-950/40 border border-amber-900/30"
                              : "text-red-400 bg-red-950/40 border border-red-900/30"
                          }`}>
                            {log.status === "Present" ? "มาเรียน" : log.status === "Late" ? "สาย" : log.status === "Absent" ? "ขาด" : "ลา"}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono block">
                            {new Date(log.timestamp).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================== */}
        {/* VIEW 2: FACIAL REGISTRATION */}
        {/* ======================================== */}
        {view === "register" && (
          <div className="max-w-2xl mx-auto space-y-6" id="view-face-registration">
            <div className="bg-[#0a0a0a] border border-white/5 p-6 rounded-2xl shadow-xl space-y-5">
              <div className="text-center border-b border-white/5 pb-4">
                <span className="text-[10px] font-mono bg-emerald-950/40 text-emerald-400 border border-emerald-900/30 px-2.5 py-1 rounded-full font-semibold">
                  FACIAL PROFILE SYSTEM
                </span>
                <h2 className="text-lg font-bold text-white mt-2 font-serif italic">ลงทะเบียนใบหน้าผู้เรียน</h2>
                <p className="text-xs text-slate-400 mt-1">
                  กรอกรหัสนักศึกษาเพื่อค้นหารายชื่อ แล้วถ่ายภาพเพื่อทำการผูกสแกนใบหน้าอัจฉริยะของคุณ
                </p>
              </div>

              {/* Step 1: Input Student ID */}
              {!matchedRegStudent ? (
                <div className="space-y-4">
                  {regError && (
                    <div className="p-3 bg-red-950/40 border border-red-900/30 text-red-400 text-xs rounded-xl flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <span>{regError}</span>
                    </div>
                  )}

                  {regSuccess && (
                    <div className="p-3 bg-emerald-950/30 border border-emerald-900/20 text-emerald-400 text-xs rounded-xl flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 flex-shrink-0" />
                      <span>{regSuccess}</span>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      id="registration-student-id-input"
                      type="text"
                      placeholder="กรอกรหัสนักศึกษา 8 หลัก (เช่น 65301001)"
                      value={regStudentId}
                      onChange={(e) => setRegStudentId(e.target.value)}
                      className="flex-1 bg-[#050505] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-700 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                    <button
                      id="lookup-student-btn"
                      onClick={handleLookupStudentReg}
                      className="py-2.5 px-5 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl text-xs font-semibold cursor-pointer transition flex items-center justify-center gap-1.5"
                    >
                      ค้นหารายชื่อ
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                /* Step 2: Show Lookup detail & Camera Shutter */
                <div className="space-y-5 animate-scaleUp">
                  
                  {/* Account detail matched */}
                  <div className="bg-[#050505] p-4 border border-white/5 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-mono text-emerald-400">VERIFIED ID MATCH</div>
                      <h4 className="font-bold text-white text-base mt-0.5 font-serif italic">{matchedRegStudent.name}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">ชั้นเรียน: {matchedRegStudent.level} | รหัส: {matchedRegStudent.studentId}</p>
                    </div>
                    
                    <button
                      id="cancel-reg-lookup-btn"
                      onClick={() => setMatchedRegStudent(null)}
                      className="px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 border border-white/5 rounded-lg text-xs font-medium cursor-pointer text-slate-300"
                    >
                      เปลี่ยนรหัส
                    </button>
                  </div>

                  {regError && (
                    <div className="p-3 bg-red-950/40 border border-red-900/30 text-red-400 text-xs rounded-xl flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      <span>{regError}</span>
                    </div>
                  )}

                  <div className="border border-dashed border-white/5 p-5 rounded-xl flex flex-col items-center bg-[#050505]/40">
                    <CameraCapture 
                      onCapture={handleFaceRegistration} 
                      isLoading={isRegisteringFace} 
                      buttonText="ถ่ายภาพและบันทึกใบหน้าเข้าระบบ"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================== */}
        {/* VIEW 3: TEACHER & ADMIN PORTAL (LOGIN REQUIRED) */}
        {/* ======================================== */}
        {view === "portal" && (
          <div id="view-portal-pane">
            
            {/* 1. If not logged in: Show dual login options */}
            {!user ? (
              <div className="max-w-md mx-auto space-y-6">
                <div className="bg-[#0a0a0a] border border-white/5 p-6 rounded-2xl shadow-xl space-y-5">
                  <div className="text-center border-b border-white/5 pb-4">
                    <span className="text-[10px] font-mono bg-emerald-950/40 text-emerald-400 border border-emerald-900/30 px-2.5 py-1 rounded-full font-semibold">
                      TEACHER & ADMIN GATEWAY
                    </span>
                    <h2 className="text-lg font-bold text-white mt-2 font-serif italic">ลงชื่อเข้าสู่ระบบจัดการ</h2>
                    <p className="text-xs text-slate-400 mt-1">สำหรับครูผู้สอนและผู้ดูแลระบบ เพื่อจัดการข้อมูลรายชื่อ</p>
                  </div>

                  {loginError && (
                    <div className="p-3 bg-red-950/40 border border-red-900/30 text-red-400 text-xs rounded-xl flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                      <span>{loginError}</span>
                    </div>
                  )}

                  {/* Facial Login Selector */}
                  {loginWithFaceActive ? (
                    <div className="space-y-4 text-center animate-scaleUp">
                      <p className="text-xs text-slate-400">กรุณามองกล้องเพื่อตรวจหาใบหน้าครูผู้สอนในการยืนยันสิทธิ์</p>
                      
                      <div className="border border-white/5 p-4 rounded-xl flex flex-col items-center bg-[#050505]/40">
                        <CameraCapture 
                          onCapture={handleFacialLogin} 
                          isLoading={isLoggingIn} 
                          buttonText="สแกนใบหน้าเข้าสู่ระบบ"
                        />
                      </div>

                      <button
                        id="cancel-face-login-btn"
                        onClick={() => setLoginWithFaceActive(false)}
                        className="text-xs text-slate-500 hover:text-slate-300 font-medium hover:underline"
                      >
                        กลับไปเข้าระบบด้วยรหัสผ่านปกติ
                      </button>
                    </div>
                  ) : (
                    /* Password Login Form */
                    <form onSubmit={handleClassicLogin} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5 font-mono">
                          USERNAME (รหัสผู้ใช้ครู หรือ admin)
                        </label>
                        <input
                          id="login-username-input"
                          type="text"
                          required
                          placeholder="กรอกชื่อผู้ใช้ เช่น teacher1 หรือ admin"
                          value={loginId}
                          onChange={(e) => setLoginId(e.target.value)}
                          className="w-full bg-[#050505] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5 font-mono">
                          PASSWORD (รหัสผ่าน)
                        </label>
                        <input
                          id="login-password-input"
                          type="password"
                          required
                          placeholder="กรอกรหัสผ่านของคุณ"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          className="w-full bg-[#050505] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                        />
                      </div>

                      <button
                        id="login-submit-btn"
                        type="submit"
                        disabled={isLoggingIn}
                        className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-[#0a0a0a] disabled:text-slate-600 text-black font-semibold text-xs uppercase tracking-wider rounded-xl transition shadow-lg cursor-pointer border border-emerald-400/20"
                      >
                        {isLoggingIn ? "กำลังประมวลผล..." : "ลงชื่อเข้าใช้งาน"}
                      </button>

                      {/* Face login trigger */}
                      <button
                        id="trigger-face-login-btn"
                        type="button"
                        onClick={() => setLoginWithFaceActive(true)}
                        className="w-full py-2.5 bg-neutral-950 hover:bg-[#050505] border border-white/5 text-emerald-400 text-xs rounded-xl transition flex items-center justify-center gap-1.5 font-semibold cursor-pointer"
                      >
                        <Scan className="w-3.5 h-3.5" />
                        เข้าใช้งานด้วยระบบสแกนใบหน้า (สำหรับคุณครู)
                      </button>
                    </form>
                  )}

                  {/* Credentials helper */}
                  <div className="p-3.5 bg-[#050505] rounded-xl border border-white/5 space-y-1 text-xs text-slate-500">
                    <p className="font-semibold text-slate-400">บัญชีสำหรับผู้ตรวจประเมิน:</p>
                    <p>• ผู้ดูแลระบบสูงสุด: ID = <code className="text-emerald-400 font-mono font-semibold">admin</code>, Password = <code className="text-emerald-400 font-mono font-semibold">44120</code></p>
                    <p>• บัญชีอาจารย์สาธิต: ID = <code className="text-emerald-400 font-mono font-semibold">teacher1</code>, Password = <code className="text-emerald-400 font-mono font-semibold">password123</code></p>
                  </div>
                </div>
              </div>
            ) : (
              /* 2. Logged In Portal: Render appropriate controls */
              <div className="space-y-6">
                
                {/* Logged in HUD info header */}
                <div className="bg-[#0a0a0a] border border-white/5 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-950/30 border border-emerald-900/30 text-emerald-400 rounded-xl">
                      <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-sm md:text-base flex items-center gap-1.5 font-serif italic">
                        ระบบจัดการฐานข้อมูลหลัก
                        <span className="text-[10px] bg-emerald-950/40 text-emerald-400 border border-emerald-900/30 px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold">
                          บทบาท: {user.role === "admin" ? "ผู้ดูแลสูงสุด (Admin)" : "ครูผู้สอน"}
                        </span>
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5 font-medium">ยินดีต้อนรับคุณ: {user.name}</p>
                    </div>
                  </div>

                  <button
                    id="logout-btn"
                    onClick={handleLogout}
                    className="w-full md:w-auto px-4 py-2 bg-neutral-950 hover:bg-[#050505] border border-white/5 hover:border-red-900/40 hover:text-red-400 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition flex items-center justify-center gap-1.5"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    ออกจากระบบ
                  </button>
                </div>

                {/* Render Teacher view or Super Admin panel depending on user.role */}
                {user.role === "admin" ? (
                  <AdminPanel 
                    logs={logs} 
                    settings={settings} 
                    teachers={teachers}
                    onSaveConfig={async (s) => {
                      const res = await fetch("/api/config", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(s)
                      });
                      if (res.ok) fetchData();
                    }}
                    onImportFromSheets={handleImportFromSheetsBackend}
                    onRegisterTeacher={handleRegisterTeacherBackend}
                    onClearLogs={handleClearLogsBackend}
                  />
                ) : (
                  <TeacherDashboard 
                    students={students} 
                    onRefresh={fetchData}
                    onAddStudent={handleAddStudentBackend}
                    onDeleteStudent={handleDeleteStudentBackend}
                    onManualCheckIn={handleManualCheckInBackend}
                    currentTeacherName={user.name}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Aesthetic Footer */}
      <footer className="border-t border-white/5 py-6 text-center text-xs text-slate-600 bg-[#050505] mt-12 space-y-1">
        <p>© 2026 Student Facial Attendance Management System. All rights reserved.</p>
        <p className="text-[10px] text-slate-700">Powered by Google Gemini 3.5 Flash & Full-Stack Node.js Engine</p>
      </footer>
    </div>
  );
}
