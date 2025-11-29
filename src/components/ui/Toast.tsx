import { AlertTriangle, CheckCircle, Info, X, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import type { Notification, NotificationType } from "../../lib/errors";

interface ToastProps {
	notification: Notification;
	onDismiss: (id: string) => void;
}

const iconMap: Record<NotificationType, React.ReactNode> = {
	success: <CheckCircle className="h-5 w-5 text-green-400" />,
	error: <XCircle className="h-5 w-5 text-red-400" />,
	warning: <AlertTriangle className="h-5 w-5 text-amber-400" />,
	info: <Info className="h-5 w-5 text-blue-400" />,
};

const bgColorMap: Record<NotificationType, string> = {
	success: "bg-green-900/90 border-green-700",
	error: "bg-red-900/90 border-red-700",
	warning: "bg-amber-900/90 border-amber-700",
	info: "bg-blue-900/90 border-blue-700",
};

function Toast({ notification, onDismiss }: ToastProps) {
	const [isExiting, setIsExiting] = useState(false);

	useEffect(() => {
		if (notification.duration) {
			const timer = setTimeout(() => {
				setIsExiting(true);
				// Wait for exit animation before dismissing
				setTimeout(() => onDismiss(notification.id), 300);
			}, notification.duration);
			return () => clearTimeout(timer);
		}
	}, [notification.duration, notification.id, onDismiss]);

	const handleDismiss = () => {
		setIsExiting(true);
		setTimeout(() => onDismiss(notification.id), 300);
	};

	return (
		<div
			role="alert"
			className={`
        flex items-start gap-3 p-4 rounded-lg border shadow-lg
        transition-all duration-300 ease-in-out
        ${bgColorMap[notification.type]}
        ${isExiting ? "opacity-0 translate-x-full" : "opacity-100 translate-x-0"}
      `}
		>
			<span className="flex-shrink-0">{iconMap[notification.type]}</span>
			<p className="flex-1 text-sm text-gray-100">{notification.message}</p>
			<button
				type="button"
				onClick={handleDismiss}
				className="flex-shrink-0 text-gray-400 hover:text-gray-200 transition-colors"
				aria-label="Dismiss notification"
			>
				<X className="h-4 w-4" />
			</button>
		</div>
	);
}

interface ToastContainerProps {
	notifications: Notification[];
	onDismiss: (id: string) => void;
}

export function ToastContainer({
	notifications,
	onDismiss,
}: ToastContainerProps) {
	if (notifications.length === 0) return null;

	return (
		<section
			className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm"
			aria-live="polite"
			aria-label="Notifications"
		>
			{notifications.map((notification) => (
				<Toast
					key={notification.id}
					notification={notification}
					onDismiss={onDismiss}
				/>
			))}
		</section>
	);
}
