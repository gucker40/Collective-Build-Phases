import { create } from 'zustand';

export const useUIStore = create((set, get) => ({
  activeView:      'chat',
  activePillar:    'logos',   // logos | dashboard | productivity | finance | data-vault | config
  artifact:        null,
  artifactOpen:    false,
  notification:    null,
  activeSession:   null,
  historyRefresh:  0,
  chatKey:         0,
  showHistory:     false,

  setActiveView:   (v) => set({ activeView: v }),
  setActivePillar: (p) => set({ activePillar: p, activeView: p }),

  openArtifact: (art) => set({ artifact: art, artifactOpen: true }),
  closeArtifact: () => set({ artifactOpen: false }),

  notify: (text, type = 'success') => {
    set({ notification: { text, type } });
    setTimeout(() => set({ notification: null }), 2800);
  },

  loadSession:    (s) => set({ activeSession: s, activeView: 'chat', activePillar: 'logos', showHistory: false }),
  newChat:        () => set(s => ({ activeSession: null, activeView: 'chat', activePillar: 'logos', chatKey: s.chatKey + 1, showHistory: false })),
  refreshHistory: () => set(s => ({ historyRefresh: s.historyRefresh + 1 })),
  toggleHistory:  () => set(s => ({ showHistory: !s.showHistory })),
}));
