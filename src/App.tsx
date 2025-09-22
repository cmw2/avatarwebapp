// Components
import { MantineProvider } from '@mantine/core';
import ChatDialog from './components/ChatDialog';

// Styles
import './App.css'
import '@mantine/core/styles.css';

export default function App() {
  return (
    <MantineProvider>
      <iframe 
        src={import.meta.env.VITE_IFRAME_URL}
        sandbox="allow-forms allow-modals allow-popups allow-same-origin allow-scripts allow-top-navigation"
        style={{ 
          position: "absolute", 
          height: "100%", 
          width: "100%", 
          border: "none", 
          top: "0" 
        }}
      />
      <ChatDialog />
    </MantineProvider>
  );
}