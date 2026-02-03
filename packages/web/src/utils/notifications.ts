/**
 * Browser Notification Utilities
 * Handles desktop notifications for critical events
 */

export interface NotificationOptions {
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  requireInteraction?: boolean;
  silent?: boolean;
}

/**
 * Check if browser supports notifications
 */
export function isNotificationSupported(): boolean {
  return 'Notification' in window;
}

/**
 * Request notification permission from user
 * Returns true if permission granted
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) {
    console.warn('Notifications not supported in this browser');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission === 'denied') {
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
}

/**
 * Show desktop notification
 * Only works if permission granted and tab is not focused
 */
export function showNotification(title: string, options: NotificationOptions = {}): void {
  if (!isNotificationSupported()) {
    return;
  }

  if (Notification.permission !== 'granted') {
    return;
  }

  // Only show if tab is not focused
  if (document.hasFocus()) {
    return;
  }

  try {
    const notification = new Notification(title, {
      body: options.body,
      icon: options.icon || '/fuse-logo.png',
      badge: options.badge || '/fuse-logo.png',
      tag: options.tag,
      data: options.data,
      requireInteraction: options.requireInteraction || false,
      silent: options.silent || false,
    });

    // Handle notification click
    notification.onclick = (event) => {
      event.preventDefault();
      window.focus();

      // Navigate to relevant page if data provided
      if (options.data?.url) {
        window.location.href = options.data.url;
      }

      notification.close();
    };
  } catch (error) {
    console.error('Error showing notification:', error);
  }
}

/**
 * Update page title with badge count
 */
export function updatePageTitleBadge(count: number): void {
  const baseTitle = 'Fuse - Agent Safety Platform';

  if (count > 0) {
    document.title = `(${count}) ${baseTitle}`;
  } else {
    document.title = baseTitle;
  }
}

/**
 * Check if page is currently visible
 */
export function isPageVisible(): boolean {
  return document.visibilityState === 'visible';
}

/**
 * Play audio alert for critical events
 */
export function playAudioAlert(type: 'info' | 'warning' | 'error' = 'info'): void {
  try {
    // Create audio context and play beep
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Set frequency based on type
    const frequencies = {
      info: 800,
      warning: 600,
      error: 400,
    };

    oscillator.frequency.value = frequencies[type];
    oscillator.type = 'sine';

    // Set volume
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (error) {
    console.error('Error playing audio alert:', error);
  }
}
