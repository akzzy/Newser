/**
 * Safe wrapper around the browser's Vibration API.
 * 
 * Note: iPhones using Safari do not widely support the Vibration API,
 * but Android Chrome supports it perfectly. This utility ensures 
 * the app never crashes on unsupported devices.
 */

export const triggerHaptic = (type: 'light' | 'medium') => {
  if (typeof window === 'undefined' || !window.navigator || !window.navigator.vibrate) {
    return;
  }

  try {
    switch (type) {
      case 'light':
        // Extremely subtle micro-tap
        window.navigator.vibrate(1);
        break;
      case 'medium':
        // Soft bump for snapping
        window.navigator.vibrate(2);
        break;
    }
  } catch (e) {
    // Ignore if browser throws a security/policy error
    console.warn('Haptic feedback failed:', e);
  }
};
