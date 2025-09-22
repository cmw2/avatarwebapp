// Libraries
import { useState } from 'react';
import { motion } from "motion/react"

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

  return (
    <Affix position={{ bottom: 108, right: 20 }} maw="400px">
      <Container p={0}>
        <Transition
          mounted={!isMinimized}
          transition="pop-bottom-right"
          duration={400}
          timingFunction="ease"
          keepMounted={true}
        >
          {(styles) => 
            <Card shadow="md" pt="xs" pb="lg" pl="lg" pr="lg" radius="md" withBorder style={styles} >
              <Flex justify="center" direction="column">
                <AvatarIcon size="sm" variant="transparent" color="dark.4" className={classes.minimizeIcon} onClick={() => setIsMinimized(true)}>
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
                        <Text fz="xs">{recognisedText}</Text>
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
          <Flex justify="flex-end" direction="row">
            <motion.div whileHover={{ scale: 1.2 }}>
            <AvatarIcon size="lg" color="blue" className={classes.affixIcon} onClick={() => setIsMinimized(false)}>
              <IconBrandHipchat size={40} />
            </AvatarIcon></motion.div>
          </Flex>
        }
      </Container>
    </Affix>
  );
}