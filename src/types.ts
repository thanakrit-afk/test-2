export interface Student {
  id: string;
  studentId: string;
  name: string;
  level: string;
  photo?: string;
  registeredAt?: string;
}

export interface Teacher {
  id: string;
  teacherId: string;
  name: string;
  photo?: boolean;
  registeredAt?: string;
}

export interface AttendanceLog {
  id: string;
  studentId: string;
  studentName: string;
  level: string;
  timestamp: string;
  status: "Present" | "Late" | "Absent" | "Excused";
  method: "Face Recognition" | "Manual";
  confidence?: number;
  photo?: string;
}

export interface Settings {
  googleSheetUrl: string;
  autoAttendance: boolean;
}

export type AppView = "check-in" | "register" | "portal";
