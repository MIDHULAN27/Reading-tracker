import { create } from 'zustand';

/**
 * Zustand store for guest-guard modal state.
 * Any component can call `openGuard(featureName)` to trigger
 * the premium login modal when an unauthenticated guest tries
 * to access a restricted feature.
 */
export const useGuestGuardStore = create((set) => ({
  isOpen: false,
  featureName: '',
  
  openGuard: (featureName = 'this feature') => 
    set({ isOpen: true, featureName }),
  
  closeGuard: () => 
    set({ isOpen: false, featureName: '' }),
}));
