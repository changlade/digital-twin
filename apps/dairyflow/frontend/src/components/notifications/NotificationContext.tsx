import { createContext, useCallback, useContext, useMemo, useReducer } from "react";

export type NotificationSeverity = "critical" | "warning";

export interface Notification {
  id: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  timestamp: Date;
  read: boolean;
  meta?: string;
}

interface NotificationState {
  notifications: Notification[];
}

type Action =
  | { type: "ADD"; payload: Notification }
  | { type: "DISMISS"; id: string }
  | { type: "MARK_ALL_READ" };

function reducer(state: NotificationState, action: Action): NotificationState {
  switch (action.type) {
    case "ADD": {
      const exists = state.notifications.some((n) => n.id === action.payload.id);
      if (exists) return state;
      return { notifications: [action.payload, ...state.notifications] };
    }
    case "DISMISS":
      return {
        notifications: state.notifications.filter((n) => n.id !== action.id),
      };
    case "MARK_ALL_READ":
      return {
        notifications: state.notifications.map((n) => ({ ...n, read: true })),
      };
    default:
      return state;
  }
}

interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (n: Omit<Notification, "timestamp" | "read">) => void;
  dismissNotification: (id: string) => void;
  markAllRead: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { notifications: [] });

  const addNotification = useCallback(
    (n: Omit<Notification, "timestamp" | "read">) => {
      dispatch({
        type: "ADD",
        payload: { ...n, timestamp: new Date(), read: false },
      });
    },
    []
  );

  const dismissNotification = useCallback((id: string) => {
    dispatch({ type: "DISMISS", id });
  }, []);

  const markAllRead = useCallback(() => {
    dispatch({ type: "MARK_ALL_READ" });
  }, []);

  const unreadCount = useMemo(
    () => state.notifications.filter((n) => !n.read).length,
    [state.notifications]
  );

  const value = useMemo(
    () => ({
      notifications: state.notifications,
      unreadCount,
      addNotification,
      dismissNotification,
      markAllRead,
    }),
    [state.notifications, unreadCount, addNotification, dismissNotification, markAllRead]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationProvider");
  return ctx;
}
