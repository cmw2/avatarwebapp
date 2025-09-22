import { create } from 'zustand';


type State = {
  chatResponses: any[];
  isListening: boolean;
  recognisedText: string;

  isAvatarConnected: boolean;
  isAvatarSpeaking: boolean;
  stopAvatarSpeaking: boolean;
}

type Action = {
  setIsListening: (isListening: State['isListening']) => void;
  setRecognisedText: (recognisedText: State['recognisedText']) => void;
}

export const useAvatar = create<State & Action>()((set) => ({
  chatResponses: [],
  addChatResponses: (value: any) => {
    set((state) => ({ chatResponses: [...state.chatResponses, value] }));
  },

  isListening: false,
  setIsListening: (value: boolean) => {
    set({ isListening: value });
  },

  recognisedText: '',
  setRecognisedText: (value: string) => {
    set({ recognisedText: value });
  },

  isAvatarConnected: false,
  setIsAvatarConnected: (value: boolean) => {
    set({ isAvatarConnected: value });
  },

  isAvatarSpeaking: false,
  setIsAvatarSpeaking: (value: boolean) => {
    set({ isAvatarSpeaking: value });
  },

  stopAvatarSpeaking: false,
  setStopAvatarSpeaking: (value: boolean) => {
    set({ stopAvatarSpeaking: value });
  },
}));