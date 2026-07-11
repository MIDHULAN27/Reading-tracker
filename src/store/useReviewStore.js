import { create } from 'zustand';
import { dbService } from '../services/db';
import { useAuthStore } from './useAuthStore';

export const useReviewStore = create((set, get) => ({
  reviews: [],
  loading: false,
  error: null,
  page: 1,
  hasMore: false,
  totalCount: 0,
  sortBy: 'helpful',

  fetchReviews: async (bookId, sortBy = 'helpful', page = 1, append = false) => {
    set({ loading: true, error: null });
    try {
      const result = await dbService.reviews.getReviews(bookId, sortBy, page, 5);
      set(state => ({
        reviews: append ? [...state.reviews, ...result.reviews] : result.reviews,
        hasMore: result.hasMore,
        totalCount: result.totalCount,
        page,
        sortBy,
        loading: false
      }));
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  submitReview: async (bookId, rating, reviewText, verified = false) => {
    set({ loading: true, error: null });
    try {
      const activeUser = useAuthStore.getState().user;
      const currentUserId = activeUser?.id || 'guest-booklyn-reader';
      const userName = activeUser?.user_metadata?.full_name || activeUser?.email || 'Anonymous Reader';
      
      const newReview = await dbService.reviews.addReview({
        book_id: bookId,
        rating,
        review_text: reviewText,
        verified
      });

      // Update state locally
      set(state => {
        // Enforce the single-review restriction locally as well
        const exists = state.reviews.some(r => r.user_id === currentUserId);
        if (exists) {
          throw new Error('You have already submitted a review for this book.');
        }
        return {
          reviews: [newReview, ...state.reviews],
          totalCount: state.totalCount + 1,
          loading: false
        };
      });
      return newReview;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  editReview: async (reviewId, rating, reviewText) => {
    const previousReviews = get().reviews;
    
    // Optimistic Update
    set(state => ({
      reviews: state.reviews.map(r => r.id === reviewId ? { ...r, rating: Number(rating), review_text: reviewText } : r),
      error: null
    }));

    try {
      const updated = await dbService.reviews.updateReview(reviewId, {
        rating: Number(rating),
        review_text: reviewText
      });
      
      set(state => ({
        reviews: state.reviews.map(r => r.id === reviewId ? updated : r)
      }));
      return updated;
    } catch (error) {
      set({ reviews: previousReviews, error: error.message });
      throw error;
    }
  },

  removeReview: async (reviewId) => {
    const previousReviews = get().reviews;
    const previousTotal = get().totalCount;

    // Optimistic Delete
    set(state => ({
      reviews: state.reviews.filter(r => r.id !== reviewId),
      totalCount: Math.max(0, state.totalCount - 1),
      error: null
    }));

    try {
      await dbService.reviews.deleteReview(reviewId);
      return true;
    } catch (error) {
      set({ reviews: previousReviews, totalCount: previousTotal, error: error.message });
      throw error;
    }
  },

  toggleReaction: async (reviewId) => {
    const activeUser = useAuthStore.getState().user;
    const userId = activeUser?.id || 'guest-booklyn-reader';
    const previousReviews = get().reviews;

    // Optimistic toggle reaction
    set(state => ({
      reviews: state.reviews.map(r => {
        if (r.id === reviewId) {
          const helpfulUsers = r.helpful_users || [];
          const updatedUsers = helpfulUsers.includes(userId)
            ? helpfulUsers.filter(uid => uid !== userId)
            : [...helpfulUsers, userId];
          return { ...r, helpful_users: updatedUsers };
        }
        return r;
      }),
      error: null
    }));

    try {
      const updated = await dbService.reviews.toggleHelpful(reviewId, userId);
      set(state => ({
        reviews: state.reviews.map(r => r.id === reviewId ? updated : r)
      }));
    } catch (error) {
      set({ reviews: previousReviews, error: error.message });
      throw error;
    }
  },

  clearError: () => set({ error: null })
}));
