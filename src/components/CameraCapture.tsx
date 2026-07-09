import React, { useRef, useState, useEffect } from "react";
import { Camera, RefreshCw, AlertCircle, Video, VideoOff } from "lucide-react";

interface CameraCaptureProps {
  onCapture: (base64Image: string) => void;
  isLoading: boolean;
  buttonText?: string;
  scannerMode?: boolean;
}

export default function CameraCapture({
  onCapture,
  isLoading,
  buttonText = "ถ่ายภาพและสแกนใบหน้า",
  scannerMode = true
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [activeDeviceId, setActiveDeviceId] = useState<string>("");
  const [isCameraOn, setIsCameraOn] = useState<boolean>(true);

  // Load available cameras
  useEffect(() => {
    async function getCameras() {
      try {
        const devicesInfo = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devicesInfo.filter(device => device.kind === "videoinput");
        setDevices(videoDevices);
        if (videoDevices.length > 0 && !activeDeviceId) {
          setActiveDeviceId(videoDevices[0].deviceId);
        }
      } catch (err) {
        console.error("Error listing cameras:", err);
      }
    }
    getCameras();
  }, [activeDeviceId]);

  // Start Camera Stream
  useEffect(() => {
    if (!isCameraOn) {
      stopCamera();
      return;
    }

    let isMounted = true;

    async function startCamera() {
      stopCamera();
      setError(null);
      
      const constraints: MediaStreamConstraints = {
        video: activeDeviceId 
          ? { deviceId: { exact: activeDeviceId }, width: { ideal: 640 }, height: { ideal: 480 } }
          : { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      };

      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        if (isMounted) {
          setStream(mediaStream);
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
          }
        }
      } catch (err: any) {
        console.error("Camera access error:", err);
        if (isMounted) {
          if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
            setError("ไม่ได้รับอนุญาตให้เข้าถึงกล้อง กรุณาเปิดสิทธิ์การเข้าใช้งานกล้องในเบราว์เซอร์");
          } else {
            setError("ไม่พบกล้องตรวจจับใบหน้า หรือกล้องกำลังถูกโปรแกรมอื่นใช้งานอยู่");
          }
        }
      }
    }

    startCamera();

    return () => {
      isMounted = false;
      stopCamera();
    };
  }, [activeDeviceId, isCameraOn]);

  function stopCamera() {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }

  // Handle Capture Action
  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    
    if (!context) return;
    
    // Set canvas resolution to match video feed
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    
    // Mirror the capture if using a standard front camera
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Reset scale/translate to avoid affecting subsequent draws
    context.setTransform(1, 0, 0, 1, 0, 0);
    
    // Convert to Base64 (JPEG format with high quality)
    const base64Data = canvas.toDataURL("image/jpeg", 0.9);
    onCapture(base64Data);
  };

  // Cycle available cameras
  const switchCamera = () => {
    if (devices.length <= 1) return;
    const currentIndex = devices.findIndex(d => d.deviceId === activeDeviceId);
    const nextIndex = (currentIndex + 1) % devices.length;
    setActiveDeviceId(devices[nextIndex].deviceId);
  };

  return (
    <div className="flex flex-col items-center w-full" id="camera-capture-container">
      {/* Viewport Frame */}
      <div className="relative w-full max-w-md aspect-video bg-neutral-900 rounded-2xl overflow-hidden border border-neutral-800 shadow-2xl flex items-center justify-center">
        {/* Mirror effect for natural video previews */}
        <video
          id="webcam-preview"
          ref={videoRef}
          autoPlay
          playsInline
          className={`w-full h-full object-cover transform -scale-x-100 ${!stream ? "hidden" : ""}`}
        />

        {/* Loading / Offline state */}
        {!stream && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-neutral-400 p-4 space-y-3">
            <RefreshCw className="w-8 h-8 animate-spin text-emerald-500" />
            <p className="text-sm font-medium">กำลังเปิดระบบกล้อง...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-neutral-950/90 text-red-400 space-y-3">
            <AlertCircle className="w-10 h-10" />
            <p className="text-sm font-semibold">{error}</p>
            <p className="text-xs text-neutral-500">
              คลิกอนุญาตสิทธิ์การใช้กล้อง หรือเปิดระบบการอนุญาตกล้องของอุปกรณ์
            </p>
          </div>
        )}

        {/* Scanner Radar Overlay */}
        {stream && scannerMode && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-between p-4">
            {/* Target Reticle */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 md:w-56 md:h-56 border-2 border-emerald-500/30 rounded-full flex items-center justify-center">
              <div className="w-40 h-40 border border-emerald-500/20 rounded-full border-dashed animate-spin" style={{ animationDuration: "12s" }} />
              <div className="absolute inset-0 border-4 border-t-emerald-500 border-r-transparent border-b-emerald-500 border-l-transparent rounded-full animate-spin" style={{ animationDuration: "3s" }} />
            </div>

            {/* Scrolling scan line */}
            <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-500 to-transparent shadow-[0_0_12px_rgba(16,185,129,0.5)] animate-bounce w-full" style={{ animationDuration: "2s" }} />

            {/* Corner Bracket decorations */}
            <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-emerald-500/40" />
            <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-emerald-500/40" />
            <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-emerald-500/40" />
            <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-emerald-500/40" />

            {/* HUD Status Text */}
            <div className="absolute top-3 left-3 bg-black/80 px-2 py-1 rounded-md border border-white/5 text-[10px] font-mono text-emerald-400 flex items-center gap-1.5 shadow-md">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              DETECTOR ACTIVE
            </div>
            
            <div className="absolute bottom-3 right-3 bg-black/80 px-2.5 py-1 rounded-md border border-white/5 text-[10px] font-mono text-slate-400 shadow-md">
              640x480px | 30 FPS
            </div>
          </div>
        )}
      </div>

      {/* Hidden processing canvas */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Camera Utility Controls */}
      <div className="flex items-center gap-3 mt-4 w-full max-w-md justify-between px-1">
        <div className="flex items-center gap-2">
          {/* On/Off Control */}
          <button
            id="toggle-camera-btn"
            type="button"
            onClick={() => setIsCameraOn(!isCameraOn)}
            className={`p-2.5 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
              isCameraOn 
                ? "bg-neutral-900 text-neutral-300 border-white/5 hover:bg-neutral-800" 
                : "bg-red-950/45 text-red-400 border-red-900/30 hover:bg-red-900/30"
            }`}
            title={isCameraOn ? "ปิดกล้อง" : "เปิดกล้อง"}
          >
            {isCameraOn ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
          </button>

          {/* Switch Camera Device */}
          {devices.length > 1 && (
            <button
              id="switch-camera-btn"
              type="button"
              onClick={switchCamera}
              className="p-2.5 rounded-xl bg-neutral-900 border border-white/5 text-neutral-300 hover:bg-neutral-800 transition-all flex items-center justify-center cursor-pointer"
              title="สลับกล้อง"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Capture Shutter Button */}
        <button
          id="capture-shutter-btn"
          type="button"
          disabled={!stream || isLoading}
          onClick={handleCapture}
          className="flex-1 py-2.5 px-4 bg-emerald-500 hover:bg-emerald-400 disabled:bg-neutral-900 disabled:text-neutral-600 disabled:cursor-not-allowed text-black font-semibold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2 cursor-pointer border border-emerald-400/20"
        >
          {isLoading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>กำลังเปรียบเทียบใบหน้า...</span>
            </>
          ) : (
            <>
              <Camera className="w-4 h-4" />
              <span>{buttonText}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
