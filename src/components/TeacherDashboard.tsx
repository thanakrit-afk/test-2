import React, { useState } from "react";
import { Student, AttendanceLog } from "../types";
import { UserPlus, Trash2, Search, CheckCircle, Clock, XCircle, AlertTriangle, RefreshCw, UserCheck } from "lucide-react";

interface TeacherDashboardProps {
  students: Student[];
  onRefresh: () => void;
  onAddStudent: (student: { studentId: string; name: string; level: string }) => Promise<void>;
  onDeleteStudent: (id: string) => Promise<void>;
  onManualCheckIn: (studentId: string, status: "Present" | "Late" | "Absent" | "Excused") => Promise<void>;
  currentTeacherName: string;
}

export default function TeacherDashboard({
  students,
  onRefresh,
  onAddStudent,
  onDeleteStudent,
  onManualCheckIn,
  currentTeacherName
}: TeacherDashboardProps) {
  // Add student form state
  const [studentId, setStudentId] = useState("");
  const [name, setName] = useState("");
  const [level, setLevel] = useState("ปวช. 1/1 แผนกเทคโนโลยีสารสนเทศ");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // Search/Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLevel, setFilterLevel] = useState("all");

  // Manual Check-in selection state
  const [selectedStudentForAttendance, setSelectedStudentForAttendance] = useState<Student | null>(null);
  const [attendanceStatus, setAttendanceStatus] = useState<"Present" | "Late" | "Absent" | "Excused">("Present");
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  // Form handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");
    
    if (!studentId.trim() || !name.trim() || !level.trim()) {
      setFormError("กรุณากรอกข้อมูลให้ครบทุกช่อง");
      return;
    }

    setIsSubmitting(true);
    try {
      await onAddStudent({ studentId: studentId.trim(), name: name.trim(), level: level.trim() });
      setFormSuccess("บันทึกข้อมูลสำเร็จ!");
      setStudentId("");
      setName("");
    } catch (err: any) {
      setFormError(err.message || "เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Manual Attendance Mark
  const handleManualCheckInSubmit = async () => {
    if (!selectedStudentForAttendance) return;
    setIsCheckingIn(true);
    try {
      await onManualCheckIn(selectedStudentForAttendance.studentId, attendanceStatus);
      setSelectedStudentForAttendance(null);
    } catch (err: any) {
      alert(err.message || "เช็คชื่อล้มเหลว");
    } finally {
      setIsCheckingIn(false);
    }
  };

  // Unique list of levels for filter dropdown
  const uniqueLevels = Array.from(new Set(students.map(s => s.level))).filter(Boolean);

  // Filtered Students
  const filteredStudents = students.filter(student => {
    const matchesSearch = 
      student.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      student.studentId.includes(searchQuery);
    
    const matchesFilter = filterLevel === "all" || student.level === filterLevel;
    
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 w-full" id="teacher-dashboard-panel">
      {/* Col 1 & 2: Student Management and Search Table */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* Search, Filter, Refresh Controls */}
        <div className="bg-[#0a0a0a] border border-white/5 p-4 rounded-2xl flex flex-col sm:flex-row items-center gap-4 justify-between">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              id="student-search-input"
              type="text"
              placeholder="ค้นหารหัสผ่าน หรือชื่อนักเรียน..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#050505] border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <select
              id="filter-level-select"
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value)}
              className="bg-[#050505] border border-white/10 text-sm text-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              <option value="all">ทุกระดับชั้น</option>
              {uniqueLevels.map(lvl => (
                <option key={lvl} value={lvl}>{lvl}</option>
              ))}
            </select>

            <button
              id="refresh-students-btn"
              onClick={onRefresh}
              className="p-2 bg-neutral-900 border border-white/5 hover:bg-neutral-850 text-slate-300 rounded-xl transition cursor-pointer"
              title="ดึงข้อมูลใหม่"
            >
              <RefreshCw className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>

        {/* Student List Board */}
        <div className="bg-[#0a0a0a] border border-white/5 rounded-2xl overflow-hidden shadow-xl">
          <div className="p-5 border-b border-white/5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white font-serif italic">รายชื่อนักเรียนนักศึกษา</h2>
              <p className="text-xs text-slate-400 mt-1">ทั้งหมด {students.length} คน | ค้นพบ {filteredStudents.length} คน</p>
            </div>
            <span className="text-xs bg-emerald-950/40 text-emerald-400 border border-emerald-900/30 px-2.5 py-1 rounded-full font-medium">
              ครูผู้สอน: {currentTeacherName}
            </span>
          </div>

          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left border-collapse" id="students-table">
              <thead>
                <tr className="border-b border-white/5 bg-[#050505] text-slate-400 text-xs font-mono font-medium">
                  <th className="py-3 px-4">รหัสนักศึกษา</th>
                  <th className="py-3 px-4">ชื่อ-นามสกุล</th>
                  <th className="py-3 px-4">ระดับชั้น/ห้อง</th>
                  <th className="py-3 px-4">สแกนใบหน้า</th>
                  <th className="py-3 px-4 text-right">การจัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm">
                {filteredStudents.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-10 text-slate-500 text-sm">
                      ไม่มีข้อมูลรายชื่อนักเรียน หรือไม่พบผลลัพธ์การค้นหา
                    </td>
                  </tr>
                ) : (
                  filteredStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-white/[0.01] transition-all group">
                      <td className="py-3.5 px-4 font-mono text-xs font-semibold text-emerald-400">
                        {student.studentId}
                      </td>
                      <td className="py-3.5 px-4 font-medium text-slate-200">
                        {student.name}
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-400">
                        {student.level}
                      </td>
                      <td className="py-3.5 px-4">
                        {student.photo ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-900/30 px-2 py-0.5 rounded-full">
                            <UserCheck className="w-3 h-3" />
                            ลงทะเบียนแล้ว
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-400 bg-amber-950/40 border border-amber-900/30 px-2 py-0.5 rounded-full animate-pulse">
                            <AlertTriangle className="w-3 h-3" />
                            ยังไม่สแกนใบหน้า
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right flex items-center justify-end gap-2">
                        {/* Manual Check-in Button */}
                        <button
                          id={`check-in-student-${student.studentId}`}
                          onClick={() => setSelectedStudentForAttendance(student)}
                          className="px-2 py-1 bg-emerald-950/40 hover:bg-emerald-950 text-emerald-300 border border-emerald-900/40 rounded-lg text-xs font-medium transition cursor-pointer"
                        >
                          เช็คชื่อ
                        </button>

                        {/* Delete Button */}
                        <button
                          id={`delete-student-${student.studentId}`}
                          onClick={() => {
                            if (confirm(`คุณต้องการลบรายชื่อนักเรียน "${student.name}" หรือไม่? ข้อมูลใบหน้าและประวัติทั้งหมดของนักเรียนคนนี้จะถูกลบ`)) {
                              onDeleteStudent(student.id);
                            }
                          }}
                          className="p-1.5 bg-neutral-900 hover:bg-red-950/40 text-slate-500 hover:text-red-400 rounded-lg border border-white/5 transition cursor-pointer"
                          title="ลบรายชื่อ"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Col 3: Sidebar Controls (Add Student, Quick Manual Check-In Modal Panel) */}
      <div className="space-y-6">
        
        {/* Form Add New Student */}
        <div className="bg-[#0a0a0a] border border-white/5 p-5 rounded-2xl shadow-xl">
          <div className="flex items-center gap-2 pb-4 mb-4 border-b border-white/5 text-emerald-400">
            <UserPlus className="w-5 h-5" />
            <h3 className="font-semibold text-white font-serif italic">เพิ่มรายชื่อนักเรียนใหม่</h3>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {formError && (
              <div className="p-3 bg-red-950/40 border border-red-900/30 text-red-400 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="p-3 bg-emerald-950/30 border border-emerald-900/20 text-emerald-400 text-xs rounded-xl flex items-center gap-2">
                <CheckCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formSuccess}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5 font-mono">
                STUDENT ID (รหัสนักศึกษา)
              </label>
              <input
                id="add-student-id-input"
                type="text"
                required
                placeholder="เช่น 65301001"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full bg-[#050505] border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                ชื่อ - นามสกุล
              </label>
              <input
                id="add-student-name-input"
                type="text"
                required
                placeholder="เช่น นายอภิสิทธิ์ รักเรียน"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#050505] border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-200 placeholder-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                ระดับชั้น / กลุ่มเรียน
              </label>
              <select
                id="add-student-level-select"
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="w-full bg-[#050505] border border-white/10 rounded-xl px-3 py-2 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="ปวช. 1/1 แผนกเทคโนโลยีสารสนเทศ">ปวช. 1/1 แผนกเทคโนโลยีสารสนเทศ</option>
                <option value="ปวช. 2/1 แผนกเทคโนโลยีสารสนเทศ">ปวช. 2/1 แผนกเทคโนโลยีสารสนเทศ</option>
                <option value="ปวช. 3/1 แผนกเทคโนโลยีสารสนเทศ">ปวช. 3/1 แผนกเทคโนโลยีสารสนเทศ</option>
                <option value="ปวส. 1/1 แผนกเทคโนโลยีสารสนเทศ">ปวส. 1/1 แผนกเทคโนโลยีสารสนเทศ</option>
                <option value="ปวส. 2/1 แผนกเทคโนโลยีสารสนเทศ">ปวส. 2/1 แผนกเทคโนโลยีสารสนเทศ</option>
                <option value="ระดับชั้นอื่นๆ">ระดับชั้นอื่นๆ / นอกเวลา</option>
              </select>
            </div>

            <button
              id="add-student-submit-btn"
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl font-semibold text-xs uppercase tracking-wider transition shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2 cursor-pointer border border-emerald-400/20"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>กำลังบันทึก...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>บันทึกข้อมูลนักเรียน</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Selected Student Attendance Mark Card */}
        {selectedStudentForAttendance && (
          <div className="bg-[#0a0a0a] border border-white/5 p-5 rounded-2xl shadow-xl space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <h3 className="font-semibold text-white font-serif italic">เช็คชื่อเข้าเรียนแบบดั้งเดิม</h3>
              <button 
                id="close-manual-attendance-btn"
                onClick={() => setSelectedStudentForAttendance(null)}
                className="text-slate-500 hover:text-slate-300 text-sm cursor-pointer"
              >
                ยกเลิก
              </button>
            </div>

            <div className="bg-[#050505] p-3.5 rounded-xl border border-white/5">
              <div className="text-[11px] font-mono text-emerald-400 mb-0.5">SELECTED STUDENT</div>
              <div className="font-semibold text-slate-200">{selectedStudentForAttendance.name}</div>
              <div className="text-xs text-slate-400 mt-0.5">ID: {selectedStudentForAttendance.studentId} | {selectedStudentForAttendance.level}</div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1.5">
                เลือกสถานะการเข้าเรียน
              </label>
              <div className="grid grid-cols-2 gap-2" id="attendance-status-options">
                <button
                  id="status-present-btn"
                  type="button"
                  onClick={() => setAttendanceStatus("Present")}
                  className={`py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    attendanceStatus === "Present" 
                      ? "bg-emerald-950/40 text-emerald-400 border-emerald-500" 
                      : "bg-[#050505] text-slate-400 border-white/5 hover:bg-neutral-900"
                  }`}
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  มาเรียน (Present)
                </button>

                <button
                  id="status-late-btn"
                  type="button"
                  onClick={() => setAttendanceStatus("Late")}
                  className={`py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    attendanceStatus === "Late" 
                      ? "bg-amber-950/40 text-amber-400 border-amber-500" 
                      : "bg-[#050505] text-slate-400 border-white/5 hover:bg-neutral-900"
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  สาย (Late)
                </button>

                <button
                  id="status-absent-btn"
                  type="button"
                  onClick={() => setAttendanceStatus("Absent")}
                  className={`py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    attendanceStatus === "Absent" 
                      ? "bg-red-950/40 text-red-400 border-red-500" 
                      : "bg-[#050505] text-slate-400 border-white/5 hover:bg-neutral-900"
                  }`}
                >
                  <XCircle className="w-3.5 h-3.5" />
                  ขาดเรียน (Absent)
                </button>

                <button
                  id="status-excused-btn"
                  type="button"
                  onClick={() => setAttendanceStatus("Excused")}
                  className={`py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition cursor-pointer ${
                    attendanceStatus === "Excused" 
                      ? "bg-emerald-950/20 text-emerald-300 border-emerald-800/40" 
                      : "bg-[#050505] text-slate-400 border-white/5 hover:bg-neutral-900"
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  ลาเรียน (Excused)
                </button>
              </div>
            </div>

            <button
              id="submit-manual-attendance-btn"
              type="button"
              disabled={isCheckingIn}
              onClick={handleManualCheckInSubmit}
              className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-neutral-900 disabled:text-neutral-500 text-black font-semibold text-xs uppercase tracking-wider rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {isCheckingIn ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>กำลังทำรายการ...</span>
                </>
              ) : (
                <span>บันทึกสถานะการเข้าเรียน</span>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
