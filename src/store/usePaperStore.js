import { create } from 'zustand';
import { dbService } from '../services/db';

export const usePaperStore = create((set, get) => ({
  savedPapers: [],
  loading: false,
  error: null,

  fetchSavedPapers: async () => {
    set({ loading: true, error: null });
    try {
      const papers = await dbService.papers.getPapers();
      set({ savedPapers: papers, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  /**
   * Optimistically bookmarks a research paper.
   * If DB insertion fails, rolls back UI to prior state.
   */
  bookmarkPaper: async (paperData) => {
    const previousSaved = get().savedPapers;

    // Check if already bookmarked
    if (previousSaved.some(p => p.id === paperData.id)) {
      return;
    }

    const tempPaper = {
      id: paperData.id,
      title: paperData.title,
      authors: paperData.authors || ['Unknown Scholar'],
      abstract: paperData.abstract || '',
      citationCount: Number(paperData.citationCount) || 0,
      pdf_url: paperData.pdf_url || null,
      year: paperData.year || 'Unknown',
      journal: paperData.journal || 'Academic Research Journal',
      fields: paperData.fields || ['Science'],
      bookmarked_at: new Date().toISOString()
    };

    // Optimistically update
    set(state => ({
      savedPapers: [tempPaper, ...state.savedPapers],
      error: null
    }));

    try {
      const savedPaper = await dbService.papers.bookmarkPaper(paperData);
      
      // Update with exact values from database
      set(state => ({
        savedPapers: state.savedPapers.map(p => p.id === tempPaper.id ? savedPaper : p)
      }));
      return savedPaper;
    } catch (error) {
      // Rollback
      set({ savedPapers: previousSaved, error: error.message });
      throw error;
    }
  },

  /**
   * Optimistically removes a research paper bookmark.
   * If DB deletion fails, rolls back UI to prior state.
   */
  unbookmarkPaper: async (paperId) => {
    const previousSaved = get().savedPapers;

    // Optimistically filter out
    set(state => ({
      savedPapers: state.savedPapers.filter(p => p.id !== paperId),
      error: null
    }));

    try {
      await dbService.papers.unbookmarkPaper(paperId);
      return true;
    } catch (error) {
      // Rollback
      set({ savedPapers: previousSaved, error: error.message });
      throw error;
    }
  },

  isBookmarked: (paperId) => {
    return get().savedPapers.some(p => p.id === paperId);
  }
}));
