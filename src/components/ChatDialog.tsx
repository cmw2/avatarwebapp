// Libraries
import { useState, useEffect } from 'react';
import { motion } from "motion/react"
import ReactMarkdown from 'react-markdown';

// Components
import { Affix, Container, Card, Flex, Transition, Paper, ScrollArea, Text, Avatar as AvatarIcon } from '@mantine/core';
import { Avatar } from './Avatar';
import { ChatInput } from './ChatInput';

// Hooks
import { useAvatar } from '../hooks/useAvatar';
import { useShallow } from 'zustand/react/shallow';

// Styles & Images
import classes from './ChatDialog.module.css';
import { IconBrandHipchat, IconChevronCompactDown } from '@tabler/icons-react';

const useAvatarSelector = (state: any) => ({
  recognisedText: state.recognisedText,
});

export default function ChatDialog() {
  const [isMinimized, setIsMinimized] = useState(true);
  const { recognisedText } = useAvatar(useShallow(useAvatarSelector));

  // Keyboard shortcut to access chat when iframe has focus
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt + C to toggle chat dialog
      if (e.altKey && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        e.stopPropagation();
        setIsMinimized(prev => !prev);
      }
    };

    // Add listener to document to catch events even when iframe has focus
    document.addEventListener('keydown', handleKeyDown, true);
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, []);

  // Focus management when dialog opens
  useEffect(() => {
    if (!isMinimized) {
      // Small delay to allow the transition to complete
      const timer = setTimeout(() => {
        const textInput = document.getElementById('chat-text-input') as HTMLInputElement;
        if (textInput) {
          textInput.focus();
        }
      }, 450); // Slightly longer than the 400ms transition

      return () => clearTimeout(timer);
    }
  }, [isMinimized]);

  return (
    <Affix position={{ bottom: 108, right: 20 }} maw="400px" style={{ zIndex: 9999 }}>
      <Container p={0} className={classes.chatDialog}>
        <Transition
          mounted={!isMinimized}
          transition="pop-bottom-right"
          duration={400}
          timingFunction="ease"
          keepMounted={true}
        >
          {(styles) => 
            <Card 
              shadow="md" 
              pt="xs" 
              pb="lg" 
              pl="lg" 
              pr="lg" 
              radius="md" 
              withBorder 
              style={{...styles, zIndex: 9999}}
              role="dialog"
              aria-label="Delaware State Parks AI Assistant"
              aria-modal="false"
            >
              <Flex justify="center" direction="column">
                <AvatarIcon 
                  size="sm" 
                  variant="transparent" 
                  color="dark.4" 
                  className={classes.minimizeIcon} 
                  onClick={() => setIsMinimized(true)}
                  component="button"
                  aria-label="Minimize chat dialog"
                >
                  <IconChevronCompactDown size={20} />
                </AvatarIcon>
                {!isMinimized && <Avatar />}
                <div id="remoteVideo"></div>
                <Transition
                  mounted={recognisedText}
                  transition="slide-up"
                  duration={400}
                  timingFunction="ease"
                  keepMounted={true}
                >
                  {(styles) => 
                    <Paper p="xs" maw={300} style={styles}>
                      <ScrollArea.Autosize mah={110} maw={300} mx="auto">
                        <Text fz="xs">
                          <ReactMarkdown
                            components={{
                              // Customize rendering to work well with Mantine's Text component
                              p: ({ children }) => <span>{children}</span>,
                              strong: ({ children }) => <strong>{children}</strong>,
                              em: ({ children }) => <em>{children}</em>,
                              a: ({ href, children }) => (
                                <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--mantine-color-blue-6)', textDecoration: 'underline' }}>
                                  {children}
                                </a>
                              ),
                              // Remove default paragraph margins for inline rendering
                              ul: ({ children }) => <ul style={{ margin: '0.25rem 0', paddingLeft: '1rem' }}>{children}</ul>,
                              ol: ({ children }) => <ol style={{ margin: '0.25rem 0', paddingLeft: '1rem' }}>{children}</ol>,
                            }}
                          >
                            {recognisedText}
                          </ReactMarkdown>
                        </Text>
                      </ScrollArea.Autosize>
                    </Paper>
                  }
                </Transition>
                <ChatInput />
              </Flex>
            </Card>
          }
        </Transition>
        {isMinimized &&
          <Flex justify="flex-end" direction="row" style={{ zIndex: 9999, position: 'relative' }}>
            <motion.div whileHover={{ scale: 1.2 }} style={{ zIndex: 9999 }}>
            <button
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                zIndex: 9999,
                position: 'relative'
              }}
              onClick={() => {
                setIsMinimized(false);
              }}
              aria-label="Open Delaware State Parks AI Assistant chat"
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setIsMinimized(false);
                }
              }}
            >
              <AvatarIcon 
                size="lg" 
                color="blue" 
                className={classes.affixIcon}
              >
                <IconBrandHipchat size={40} />
              </AvatarIcon>
            </button></motion.div>
          </Flex>
        }
        {/* Live region for screen reader announcements */}
        <div 
          aria-live="polite" 
          aria-atomic="true" 
          style={{ position: 'absolute', left: '-10000px' }}
        >
          {!isMinimized ? 'Chat dialog opened. Press Alt+C to close.' : 'Chat dialog minimized. Press Alt+C to open chat or click the chat icon.'}
        </div>
        
        {/* Keyboard shortcut indicator */}
        {isMinimized && (
          <div 
            style={{ 
              position: 'fixed', 
              bottom: '10px', 
              right: '10px', 
              background: 'rgba(0,0,0,0.7)', 
              color: 'white', 
              padding: '4px 8px', 
              borderRadius: '4px', 
              fontSize: '11px',
              zIndex: 10000,
              pointerEvents: 'none'
            }}
          >
            Press Alt+C for chat
          </div>
        )}
      </Container>
    </Affix>
  );
}