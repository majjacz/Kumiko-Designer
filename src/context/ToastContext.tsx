import {
	createContext,
	useCallback,
	useContext,
	useMemo,
	useState,
} from "react";
import { ToastContainer } from "../components/ui/Toast";
import {
	DEFAULT_NOTIFICATION_DURATIONS,
	type Notification,
	type NotificationType,
} from "../lib/errors";

interface ToastContextValue {
	/** Show a notification toast */
	showToast: (
		type: NotificationType,
		message: string,
		duration?: number,
	) => void;
	/** Dismiss a specific notification */
	dismissToast: (id: string) => void;
	/** Dismiss all notifications */
	dismissAll: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastIdCounter = 0;

interface ToastProviderProps {
	children: React.ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
	const [notifications, setNotifications] = useState<Notification[]>([]);

	const showToast = useCallback(
		(type: NotificationType, message: string, duration?: number) => {
			const id = `toast-${++toastIdCounter}`;
			const notification: Notification = {
				id,
				type,
				message,
				duration: duration ?? DEFAULT_NOTIFICATION_DURATIONS[type],
			};
			setNotifications((prev) => [...prev, notification]);
		},
		[],
	);

	const dismissToast = useCallback((id: string) => {
		setNotifications((prev) => prev.filter((n) => n.id !== id));
	}, []);

	const dismissAll = useCallback(() => {
		setNotifications([]);
	}, []);

	const value = useMemo(
		() => ({ showToast, dismissToast, dismissAll }),
		[showToast, dismissToast, dismissAll],
	);

	return (
		<ToastContext value={value}>
			{children}
			<ToastContainer notifications={notifications} onDismiss={dismissToast} />
		</ToastContext>
	);
}

/**
 * Hook to access toast notification functions
 * @throws Error if used outside of ToastProvider
 */
export function useToast(): ToastContextValue {
	const context = useContext(ToastContext);
	if (!context) {
		throw new Error("useToast must be used within a ToastProvider");
	}
	return context;
}

/**
 * Optional hook that returns null if used outside of ToastProvider
 * Useful for library code that may or may not have toast support
 */
export function useToastOptional(): ToastContextValue | null {
	return useContext(ToastContext);
}
