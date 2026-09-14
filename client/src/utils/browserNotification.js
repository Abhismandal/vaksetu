/**
 * Browser Desktop Notification Helper
 */
export const requestNotificationPermission = async () => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'default') {
    return await Notification.requestPermission();
  }
  return Notification.permission;
};

export const showBrowserNotification = ({ title, body, icon, onClick }) => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return null;
  }

  if (Notification.permission === 'granted' && document.hidden) {
    try {
      const notif = new Notification(title || 'New Message', {
        body: body || 'You received a new message',
        icon: icon || '/favicon.ico',
        badge: '/favicon.ico',
        silent: true, // We already play our melodic web audio chime
      });

      if (onClick) {
        notif.onclick = () => {
          window.focus();
          onClick();
          notif.close();
        };
      }

      return notif;
    } catch (err) {
      console.debug('Browser notification failed:', err);
    }
  }

  return null;
};
