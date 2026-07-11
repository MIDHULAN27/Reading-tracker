import { useAuthStore } from '../store/useAuthStore';
import { useGuestGuardStore } from '../store/useGuestGuardStore';

/**
 * Hook that returns a guard function.
 * Usage:
 *   const guard = useGuestGuard();
 *   
 *   const handleAddToLibrary = () => {
 *     if (guard('Library')) return; // blocked — modal shown
 *     // ... proceed with action
 *   };
 * 
 * Returns `true` if the user is a guest (action blocked),
 * `false` if they are authenticated (action allowed).
 */
export function useGuestGuard() {
  const user = useAuthStore((s) => s.user);
  const openGuard = useGuestGuardStore((s) => s.openGuard);

  return (featureName = 'this feature', redirectPath = null) => {
    if (!user || user.is_anonymous || user.email?.includes('guest')) {
      console.log("Protected feature clicked");
      const currentPath = redirectPath || window.location.pathname;
      localStorage.setItem("redirectAfterLogin", currentPath);
      openGuard(featureName);
      return true; // blocked
    }
    return false; // allowed
  };
}
