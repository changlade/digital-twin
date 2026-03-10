import { useEffect, useRef, useState } from "react";
import { Bell, AlertTriangle, Clock, X, CheckCheck } from "lucide-react";
import { useNotifications } from "./NotificationContext";
import { cn } from "../../lib/utils";

export default function NotificationBell() {
  const { notifications, unreadCount, dismissNotification, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close panel on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleOpen() {
    setOpen((v) => !v);
    if (!open) markAllRead();
  }

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={buttonRef}
        onClick={handleOpen}
        className={cn(
          "relative flex items-center justify-center w-8 h-8 rounded-full transition-all",
          open
            ? "bg-danone-blue/20 text-white"
            : "text-danone-gray-400 hover:bg-danone-gray-700 hover:text-white"
        )}
        aria-label="Notifications"
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-4 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold leading-none">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-10 z-50 w-[380px] rounded-xl border border-danone-gray-700 bg-danone-gray-900 shadow-2xl animate-fade-in"
        >
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-danone-gray-700">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-danone-gray-400" />
              <span className="text-sm font-semibold text-white">Notifications</span>
              {notifications.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-danone-gray-700 text-danone-gray-400 text-[10px] font-medium">
                  {notifications.length}
                </span>
              )}
            </div>
            {notifications.length > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-[11px] text-danone-gray-400 hover:text-danone-lightblue transition-colors"
              >
                <CheckCheck size={12} />
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-[420px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-danone-gray-500">
                <Bell size={24} className="mb-2 opacity-30" />
                <p className="text-xs">No notifications</p>
              </div>
            ) : (
              <ul className="divide-y divide-danone-gray-700/50">
                {notifications.map((n) => {
                  const isCritical = n.severity === "critical";
                  return (
                    <li
                      key={n.id}
                      className={cn(
                        "flex items-start gap-3 px-4 py-3 transition-colors",
                        !n.read && "bg-danone-gray-800/40"
                      )}
                    >
                      <AlertTriangle
                        size={14}
                        className={cn(
                          "mt-0.5 shrink-0",
                          isCritical ? "text-red-400" : "text-yellow-400"
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "text-xs font-semibold leading-snug",
                            isCritical ? "text-red-300" : "text-yellow-300"
                          )}
                        >
                          {n.title}
                        </p>
                        <p className="text-[11px] text-danone-gray-400 mt-0.5 leading-relaxed">
                          {n.message}
                        </p>
                        {n.meta && (
                          <div className="flex items-center gap-1 mt-1 text-danone-gray-500 text-[10px]">
                            <Clock size={10} />
                            <span>{n.meta}</span>
                          </div>
                        )}
                        <p className="text-[10px] text-danone-gray-600 mt-1">
                          {n.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                      <button
                        onClick={() => dismissNotification(n.id)}
                        className="shrink-0 text-danone-gray-600 hover:text-danone-gray-300 transition-colors mt-0.5"
                        aria-label="Dismiss"
                      >
                        <X size={12} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
