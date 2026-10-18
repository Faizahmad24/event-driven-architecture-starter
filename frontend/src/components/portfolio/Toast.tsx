import { useEffect } from "react";

export interface ToastNotification {
  type: "success" | "error";
  message: string;
}

export default function Toast({ notification, onClose }: {
  notification: ToastNotification;
  onClose: () => void;
}) {
  useEffect(() => {
    if (notification.type !== "success") return;
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [notification, onClose]);

  return (
    <div className={`dashboard-toast dashboard-toast--${notification.type}`}>
      <span className="toast-icon" aria-hidden="true">{notification.type === "success" ? "✓" : "!"}</span>
      <div role={notification.type === "error" ? "alert" : "status"} aria-atomic="true">
        <strong>{notification.type === "success" ? "Published" : "Unable to publish"}</strong>
        <p>{notification.message}</p>
      </div>
      <button type="button" className="toast-close" aria-label="Dismiss notification" onClick={onClose}>×</button>
    </div>
  );
}
