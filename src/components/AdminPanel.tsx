import React, { useState } from "react";
import { AttendanceLog, Settings, Teacher } from "../types";
import { 
  FileSpreadsheet, ShieldAlert, Users, Trash2, Calendar, 
  ExternalLink, CheckCircle, Clock, XCircle, AlertTriangle, 
  RefreshCw, Award, Image, UserPlus, KeyRound
} from "lucide-react";

interface AdminPanelProps {
  logs: AttendanceLog[];
  settings: Settings;
  teachers: Teacher[];
  onSaveConfig: (settings: Settings) => Promise<void>;
  onImportFromSheets: (url: string) => Promise<void>;
  onRegisterTeacher: (teacher: any) => Promise<void>;
  onClearLogs: () => Promise<void>;
}

export default function AdminPanel({
  logs,
  settings,
  teachers,
  onSaveConfig,
  onImportFromSheets,
  onRegisterTeacher,
  onClearLogs
}: AdminPanelProps) {
  // Google Sheets integration state
  const [googleSheetUrl, setGoogleSheetUrl] = useState(settings.googleSheetUrl || "");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState({ success: false, error: "", message: "" });

  // New Teacher register state
  const [teacherId, setTeacherId] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [teacherPassword, setTeacherPassword] = useState("");
  const [isRegisteringTeacher, setIsRegisteringTeacher] = useState(false);
  const [teacherStatus, setTeacherStatus] = useState({ success: false, error: "", message: "" });

  // Filter logs state
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");

  // Selected Log Photo modal state
  const [selectedLogPhoto, setSelectedLogPhoto] = useState<string | null>(null);

  // Sync Google Sheets
  const handleSheetsSync = async (e: React.FormEvent) => {
    e.preventDefault();
    setSyncStatus({ success: false, error: "", message: "" });
    if (!googleSheetUrl.trim()) {
      setSyncStatus({ success: false, error: "กรุณากรอกลิงก์ Google Sheet", message: "" });
      return;
    }

    setIsSyncing(true);
    try {
      await onImportFromSheets(googleSheetUrl.trim());
      setSyncStatus({ success: true, error: "", message: "นำเข้าข้อมูลจาก Google Sheets เรียบร้อยแล้ว!" });
    } catch (err: any) {
      setSyncStatus({ success: false, error: err.message || "เกิดข้อผิดพลาดในการดึงข้อมูลจากชีต", message: "" });
    } finally {
      setIsSyncing(false);
    }
  };

  // Register New Teacher
  const handleRegisterTeacherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeacherStatus({ success: false, error: "", message: "" });
    
    if (!teacherId.trim() || !teacherName.trim() || !teacherPassword.trim()) {
      setTeacherStatus({ success: false, error: "กรุณากรอกข้อมูลครูใหม่ให้ครบถ้วน", message: "" });
      return;
    }

    setIsRegisteringTeacher(true);
    try {
      await onRegisterTeacher({
        teacherId: teacherId.trim(),
        name: teacherName.trim(),
        password: teacherPassword.trim()
      });
      setTeacherStatus({ success: true, error: "", message: `สร้างบัญชีอาจารย์ "${teacherName}" เรียบร้อยแล้ว!` });
      setTeacherId("");
      setTeacherName("");
      setTeacherPassword("");
    } catch (err: any) {
      setTeacherStatus({ success: false, error: err.message || "เกิดข้อผิดพลาดในการสร้างบัญชี", message: "" });
    } finally {
      setIsRegisteringTeacher(false);
    }
  };

  // Filter logs
  const filteredLogs = logs.filter(log => {
    const matchesStatus = statusFilter === "all" || log.status === statusFilter;
    const matchesMethod = methodFilter === "all" || log.method === methodFilter;
    return matchesStatus && matchesMethod;
  });

  // Calculate statistics
  const presentCount = logs.filter(l => l.status === "Present").length;
  const lateCount = logs.filter(l => l.status === "Late").length;
  const absentCount = logs.filter(l => l.status === "Absent").length;
  const excusedCount = logs.filter(l => l.status === "Excused").length;

  return (
    <div className="space-y-6" id="admin-panel-container">
      
      {/* Cards stats header */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" id="attendance-statistics-dashboard">
        <div className="bg-[#0a0a0a] border border-white/5 p-4 rounded-2xl flex items-center gap-3.5 shadow-md">
          <div className="p-2.5 bg-emerald-950/40 text-emerald-400 border border-emerald-900/30 rounded-xl">
            <CheckCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">มาเรียนตรงเวลา</div>
            <div className="text-xl font-bold text-white">{presentCount} <span className="text-xs text-slate-500 font-normal">คน</span></div>
          </div>
        </div>

        <div className="bg-[#0a0a0a] border border-white/5 p-4 rounded-2xl flex items-center gap-3.5 shadow-md">
          <div className="p-2.5 bg-amber-950/40 text-amber-400 border border-amber-900/30 rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">เข้าเรียนสาย</div>
            <div className="text-xl font-bold text-white">{lateCount} <span className="text-xs text-slate-500 font-normal">คน</span></div>
          </div>
        </div>

        <div className="bg-[#0a0a0a] border border-white/5 p-4 rounded-2xl flex items-center gap-3.5 shadow-md">
          <div className="p-2.5 bg-red-950/40 text-red-400 border border-red-900/30 rounded-xl">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">ขาดเรียน/ไม่แสดงตัว</div>
            <div className="text-xl font-bold text-white">{absentCount} <span className="text-xs text-slate-500 font-normal">คน</span></div>
          </div>
        </div>

        <div className="bg-[#0a0a0a] border border-white/5 p-4 rounded-2xl flex items-center gap-3.5 shadow-md">
          <div className="p-2.5 bg-emerald-950/20 text-emerald-400 border border-emerald-900/10 rounded-xl">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">ลาเรียน</div>
            <div className="text-xl font-bold text-white">{excusedCount} <span className="text-xs text-slate-500 font-normal">คน</span></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Col 1 & 2: Google sheets & Attendance Log Audit list */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Google Sheets syncing controls */}
          <div className="bg-[#0a0a0a] border border-white/5 p-5 rounded-2xl shadow-xl">
            <div className="flex items-center gap-2.5 pb-4 mb-4 border-b border-white/5 text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
              <h3 className="font-semibold text-white font-serif italic">ดึงข้อมูลและนักเรียนจาก Google Sheets</h3>
            </div>

            <form onSubmit={handleSheetsSync} className="space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                คุณสามารถดึงข้อมูลรายชื่อนักเรียนจาก Google Sheets ได้โดยตรง โดยนำลิงก์แชร์ของ Google Sheet วางลงด้านล่างนี้ (ชีตต้องแชร์เป็นแบบ <b>'ทุกคนที่มีลิงก์มีสิทธิ์อ่าน (Anyone with the link can view)'</b>) และต้องมี 3 คอลัมน์หลัก คือ รหัสนักเรียน, ชื่อ-นามสกุล, ระดับชั้น
              </p>

              {syncStatus.error && (
                <div className="p-3 bg-red-950/40 border border-red-900/30 text-red-400 text-xs rounded-xl flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                  <span>{syncStatus.error}</span>
                </div>
              )}

              {syncStatus.message && (
                <div className="p-3 bg-emerald-950/30 border border-emerald-900/20 text-emerald-400 text-xs rounded-xl flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{syncStatus.message}</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <input
                  id="google-sheet-url-input"
                  type="url"
                  placeholder="เช่น https://docs.google.com/spreadsheets/d/.../edit?usp=sharing"
                  value={googleSheetUrl}
                  onChange={(e) => setGoogleSheetUrl(e.target.value)}
                  className="flex-1 w-full bg-[#050505] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-slate-300 placeholder-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                
                <button
                  id="sync-sheets-submit-btn"
                  type="submit"
                  disabled={isSyncing}
                  className="w-full sm:w-auto py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 disabled:bg-[#0a0a0a] disabled:text-slate-600 text-black rounded-xl font-semibold text-xs uppercase tracking-wider transition flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isSyncing ? (
                    <>
                      <RefreshCw className="w-4.5 h-4.5 animate-spin" />
                      <span>กำลังซิงค์รายชื่อ...</span>
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4.5 h-4.5" />
                      <span>ซิงค์รายชื่อนักเรียน</span>
                    </>
                  )}
                </button>
              </div>

              {/* Sample test sheet for users */}
              <div className="text-[11px] text-slate-500 flex items-center gap-1">
                <span>ต้องการแผ่นจำลองสำหรับทดสอบ?</span>
                <a 
                  href="https://docs.google.com/spreadsheets/d/1O9N86NbyFmshU4E8oEsh-YgP67FkL6Z5W3X06_BFrHw/edit?usp=sharing"
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-400 hover:underline flex items-center gap-0.5 font-medium"
                >
                  คลิกเพื่อดูโครงสร้างตัวอย่างชีต <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </div>
            </form>
          </div>

          {/* Audit Logs list with verification screenshots */}
          <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
            <div className="p-5 border-b border-white/5 flex flex-col sm:flex-row items-center gap-4 justify-between">
              <div>
                <h3 className="font-semibold text-white font-serif italic">ประวัติการเช็คชื่อผู้เรียน (Attendance Logs)</h3>
                <p className="text-xs text-slate-400 mt-1">แสดงประวัติ บันทึกการเปรียบเทียบใบหน้า และสถานะเข้าเรียน</p>
              </div>

              <div className="flex items-center gap-2">
                {/* Clear all logs */}
                {logs.length > 0 && (
                  <button
                    id="clear-logs-btn"
                    onClick={() => {
                      if (confirm("คุณยืนยันที่จะลบประวัติการเช็คชื่อทั้งหมดหรือไม่? ภาพบันทึกและประวัติจะถูกลบถาวร")) {
                        onClearLogs();
                      }
                    }}
                    className="px-3 py-1.5 bg-red-950/40 hover:bg-red-900/30 text-red-400 border border-red-900/40 rounded-xl text-xs font-semibold cursor-pointer transition flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    ล้างประวัติ
                  </button>
                )}
              </div>
            </div>

            {/* Filter Logs */}
            <div className="bg-[#050505] p-4 border-b border-white/5 flex flex-wrap items-center gap-3 justify-between">
              <div className="flex items-center gap-2.5 text-xs text-slate-400">
                <span>กรองสถานะ:</span>
                <select
                  id="log-status-filter-select"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-[#0a0a0a] border border-white/10 rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="all">ทุกสถานะ</option>
                  <option value="Present">มาเรียนตรงเวลา</option>
                  <option value="Late">เข้าเรียนสาย</option>
                  <option value="Absent">ขาดเรียน</option>
                  <option value="Excused">ลาเรียน</option>
                </select>

                <span>กรองวิธี:</span>
                <select
                  id="log-method-filter-select"
                  value={methodFilter}
                  onChange={(e) => setMethodFilter(e.target.value)}
                  className="bg-[#0a0a0a] border border-white/10 rounded-lg px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="all">ทุกวิธี</option>
                  <option value="Face Recognition">สแกนด้วยใบหน้า</option>
                  <option value="Manual">ระบุแบบธรรมดา</option>
                </select>
              </div>
              
              <div className="text-[11px] font-mono text-slate-500">
                กรองเจอ {filteredLogs.length} รายการ
              </div>
            </div>

            <div className="overflow-x-auto max-h-[400px]">
              <table className="w-full text-left border-collapse" id="logs-table">
                <thead>
                  <tr className="border-b border-white/5 bg-[#050505] text-slate-400 text-[11px] font-mono font-medium">
                    <th className="py-3 px-4">รูปถ่าย</th>
                    <th className="py-3 px-4">ชื่อผู้เรียน / ID</th>
                    <th className="py-3 px-4">วัน-เวลา</th>
                    <th className="py-3 px-4">สถานะ</th>
                    <th className="py-3 px-4">วิธีสแกน</th>
                    <th className="py-3 px-4 text-right">ความแม่นยำ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-sm">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-slate-500 text-xs">
                        ไม่มีประวัติการเช็คชื่อตามการกรองปัจจุบัน
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-white/[0.01] transition-all text-slate-300">
                        <td className="py-2.5 px-4">
                          {log.photo ? (
                            <button
                              id={`view-photo-log-${log.id}`}
                              onClick={() => setSelectedLogPhoto(log.photo!)}
                              className="w-10 h-10 rounded-lg overflow-hidden border border-white/10 hover:border-emerald-400 transition cursor-pointer flex items-center justify-center bg-neutral-900"
                              title="คลิกเพื่อดูรูปขยาย"
                            >
                              <img src={log.photo} alt="Verification" className="w-full h-full object-cover" />
                            </button>
                          ) : (
                            <div className="w-10 h-10 rounded-lg border border-white/5 bg-[#050505] flex items-center justify-center text-slate-600">
                              <Image className="w-4 h-4" />
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-4">
                          <div className="font-semibold text-slate-200 text-xs">{log.studentName}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">รหัส: {log.studentId} | {log.level}</div>
                        </td>
                        <td className="py-2.5 px-4 font-mono text-xs">
                          {new Date(log.timestamp).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                          <span className="text-[10px] text-slate-500 block">
                            {new Date(log.timestamp).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          {log.status === "Present" && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-950/40 border border-emerald-900/30 px-2 py-0.5 rounded-full">
                              <CheckCircle className="w-3 h-3" /> มาเรียน
                            </span>
                          )}
                          {log.status === "Late" && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-400 bg-amber-950/40 border border-amber-900/30 px-2 py-0.5 rounded-full">
                              <Clock className="w-3 h-3" /> สาย
                            </span>
                          )}
                          {log.status === "Absent" && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-400 bg-red-950/40 border border-red-900/30 px-2 py-0.5 rounded-full">
                              <XCircle className="w-3 h-3" /> ขาดเรียน
                            </span>
                          )}
                          {log.status === "Excused" && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-300 bg-emerald-950/20 border border-emerald-900/20 px-2 py-0.5 rounded-full">
                              <AlertTriangle className="w-3 h-3" /> ลาเรียน
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-xs font-medium text-slate-400">
                          {log.method === "Face Recognition" ? (
                            <span className="text-emerald-400 font-semibold">สแกนใบหน้า AI</span>
                          ) : (
                            <span className="text-slate-500">บันทึกมือ</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          {log.confidence ? (
                            <span className="font-mono text-xs font-bold text-emerald-400">
                              {log.confidence}%
                            </span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Col 3: Teacher account creator */}
        <div className="space-y-6">
          
          {/* Create Teacher Form */}
          <div className="bg-[#0a0a0a] border border-white/5 p-5 rounded-2xl shadow-xl">
            <div className="flex items-center gap-2 pb-4 mb-4 border-b border-white/5 text-emerald-400">
              <UserPlus className="w-5 h-5" />
              <h3 className="font-semibold text-white font-serif italic">สร้างบัญชีอาจารย์ใหม่</h3>
            </div>

            <form onSubmit={handleRegisterTeacherSubmit} className="space-y-4">
              {teacherStatus.error && (
                <div className="p-3 bg-red-950/40 border border-red-900/30 text-red-400 text-xs rounded-xl flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 flex-shrink-0" />
                  <span>{teacherStatus.error}</span>
                </div>
              )}

              {teacherStatus.message && (
                <div className="p-3 bg-emerald-950/30 border border-emerald-900/20 text-emerald-400 text-xs rounded-xl flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{teacherStatus.message}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 font-mono">
                  TEACHER ID / USERNAME
                </label>
                <input
                  id="add-teacher-id-input"
                  type="text"
                  required
                  placeholder="เช่น t-002"
                  value={teacherId}
                  onChange={(e) => setTeacherId(e.target.value)}
                  className="w-full bg-[#050505] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  ชื่อ - นามสกุล (อาจารย์)
                </label>
                <input
                  id="add-teacher-name-input"
                  type="text"
                  required
                  placeholder="เช่น อาจารย์ณรงค์ชัย ใจมั่น"
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  className="w-full bg-[#050505] border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 font-mono">
                  PASSWORD
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    id="add-teacher-password-input"
                    type="password"
                    required
                    placeholder="รหัสผ่านเข้าใช้งาน"
                    value={teacherPassword}
                    onChange={(e) => setTeacherPassword(e.target.value)}
                    className="w-full bg-[#050505] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
                  />
                </div>
              </div>

              <button
                id="add-teacher-submit-btn"
                type="submit"
                disabled={isRegisteringTeacher}
                className="w-full py-2 px-4 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl font-semibold text-xs uppercase tracking-wider transition shadow-lg flex items-center justify-center gap-1.5 cursor-pointer border border-emerald-400/20"
              >
                {isRegisteringTeacher ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>กำลังประมวลผล...</span>
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>สร้างบัญชีอาจารย์</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* List of Teachers */}
          <div className="bg-[#0a0a0a] border border-white/5 p-5 rounded-2xl shadow-xl">
            <div className="flex items-center gap-2 pb-3 mb-3 border-b border-white/5 text-emerald-400">
              <Users className="w-5 h-5" />
              <h3 className="font-semibold text-white font-serif italic">รายชื่อครูอาจารย์ในระบบ</h3>
            </div>

            <div className="space-y-2.5 max-h-[180px] overflow-y-auto pr-1">
              {teachers.map((teacher) => (
                <div key={teacher.id} className="p-3 bg-[#050505] rounded-xl border border-white/5 flex items-center justify-between text-xs">
                  <div>
                    <div className="font-semibold text-slate-200">{teacher.name}</div>
                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">ID: {teacher.teacherId}</div>
                  </div>
                  <span className="text-[10px] font-mono text-slate-500">
                    Active
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Expanded verification photo modal */}
      {selectedLogPhoto && (
        <div 
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedLogPhoto(null)}
          id="photo-viewer-modal"
        >
          <div 
            className="bg-[#0a0a0a] border border-white/5 rounded-2xl max-w-lg w-full overflow-hidden p-3 shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3.5 mb-3.5 border-b border-white/5 px-1">
              <h4 className="font-semibold text-white text-sm flex items-center gap-2 font-serif italic">
                <Award className="w-4.5 h-4.5 text-emerald-400" />
                รูปถ่ายยืนยันใบหน้าผู้เรียนขณะเช็คชื่อ
              </h4>
              <button 
                id="close-photo-modal-btn"
                onClick={() => setSelectedLogPhoto(null)}
                className="text-xs text-slate-400 hover:text-white bg-neutral-900 px-2.5 py-1 rounded-lg border border-white/5 cursor-pointer"
              >
                ปิดรูปขยาย
              </button>
            </div>
            <img 
              src={selectedLogPhoto} 
              alt="Verification Capture" 
              className="w-full aspect-video object-cover rounded-xl border border-white/10 shadow-inner" 
            />
          </div>
        </div>
      )}
    </div>
  );
}
