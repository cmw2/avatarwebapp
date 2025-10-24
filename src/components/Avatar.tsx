// Libraries
import { useState, useEffect, useRef, useCallback } from "react";
import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";
import { remark } from 'remark';
import stripMarkdown from 'strip-markdown';

// Components
import { Card, Center, Image } from '@mantine/core';

// Hooks
import { useAvatar } from '../hooks/useAvatar';
import { useShallow } from 'zustand/react/shallow';

// Styles
import "./Avatar.css";

// Function to convert markdown to plain text for speech
function markdownToSpeechText(markdown: string): string {
  try {
    // First, convert links to include URLs for speech
    const withUrls = markdown.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 at $2');
    
    // Use remark + strip-markdown for conversion
    const processor = remark().use(stripMarkdown);
    const result = processor.processSync(withUrls);
        
    return String(result).trim();
  } catch (error) {
    console.error('Error processing markdown:', error);
    // If remark fails, fall back to simple approach
    return markdown.replace(/\s{2,}/g, ' ').trim();
  }
}

// Avatar Details
const cognitiveServicesRegion = import.meta.env.VITE_COGNITIVE_SERVICES_REGION;
const cognitiveServicesKey = import.meta.env.VITE_COGNITIVE_SERVICES_KEY;
const avatarVoiceName = import.meta.env.VITE_AVATAR_VOICE_NAME;
const avatarCharacter = import.meta.env.VITE_AVATAR_CHARACTER;
const avatarStyle = import.meta.env.VITE_AVATAR_STYLE;

export interface RTCConfiguration {
  urls: string;
  username: string;
  credential: string;
}

export interface MediaTrackEvent {
  track: MediaStreamTrack;
  streams: MediaStream[];
}

const useAvatarSelector = (state: any) => ({
  isListening: state.isListening,
  recognisedText: state.recognisedText,
  setIsListening: state.setIsListening,
  setRecognisedText: state.setRecognisedText,
  setIsAvatarConnected: state.setIsAvatarConnected,
  setIsAvatarSpeaking: state.setIsAvatarSpeaking,
  stopAvatarSpeaking: state.stopAvatarSpeaking,
  setStopAvatarSpeaking: state.setStopAvatarSpeaking,
  isAvatarConnected: state.isAvatarConnected,
});

function getAvatarConfig() {
  const xhr = new XMLHttpRequest();
    xhr.open('GET', `https://${cognitiveServicesRegion}.tts.speech.microsoft.com/cognitiveservices/avatar/relay/token/v1`, false);
    xhr.setRequestHeader("Ocp-Apim-Subscription-Key", cognitiveServicesKey)
    xhr.send();

    if (xhr.status === 200) {
      const responseData = JSON.parse(xhr.responseText)
      const iceServerUrl = responseData.Urls[0]
      const iceServerUsername = responseData.Username
      const iceServerCredential = responseData.Password
      console.log("GOT CONFIG")
      return({ 
        urls: iceServerUrl, 
        username: iceServerUsername, 
        credential: iceServerCredential,
      });
    } else {
        throw new Error('Failed to fetch data');
    }
}

const createAvatarSynthesizer = () => {
  const speechSynthesisConfig = SpeechSDK.SpeechConfig.fromSubscription(cognitiveServicesKey, cognitiveServicesRegion)
  const videoFormat = new SpeechSDK.AvatarVideoFormat()
  speechSynthesisConfig.speechSynthesisVoiceName = avatarVoiceName;

  let videoCropTopLeftX =  600
  let videoCropBottomRightX = 1320
  videoFormat.setCropRange(new SpeechSDK.Coordinate(videoCropTopLeftX, 50), new SpeechSDK.Coordinate(videoCropBottomRightX, 1080));

  const talkingAvatarCharacter = avatarCharacter
  const talkingAvatarStyle = avatarStyle

  const avatarConfig = new SpeechSDK.AvatarConfig(talkingAvatarCharacter, talkingAvatarStyle, videoFormat)
  avatarConfig.backgroundColor = '#FFFFFF';
  let avatarSynthesizer = new SpeechSDK.AvatarSynthesizer(speechSynthesisConfig, avatarConfig)

  avatarSynthesizer.avatarEventReceived = function (s, e) {
    var offsetMessage = ", offset from session start: " + e.offset / 10000 + "ms."
    if (e.offset === 0) {
      offsetMessage = ""
    }
    // console.log("[" + (new Date()).toISOString() + "] Event received: " + e.description + offsetMessage)
  }

  return avatarSynthesizer;
}

export const Avatar = () => {
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [avatarSynthesizer, setAvatarSynthesizer] = useState<SpeechSDK.AvatarSynthesizer | null>(null);
  const myAvatarVideoEleRef = useRef<HTMLVideoElement>(null);
  const myAvatarAudioEleRef = useRef<HTMLAudioElement>(null);
  
  const { 
    recognisedText, 
    setRecognisedText, 
    setIsAvatarSpeaking, 
    stopAvatarSpeaking, 
    setStopAvatarSpeaking, 
    setIsAvatarConnected,
    isAvatarConnected,
  } = useAvatar(useShallow(useAvatarSelector));

  const handleTrack = useCallback((event: RTCTrackEvent) => {
    if (!myAvatarVideoEleRef.current || !myAvatarAudioEleRef.current) {
      console.warn("Media elements not initialized");
      return;
    }

    const mediaElement = event.track.kind === 'video' ? myAvatarVideoEleRef.current : myAvatarAudioEleRef.current;

    try {
      mediaElement.srcObject = event.streams[0];
      
      if (event.track.kind === 'video') {
        mediaElement.onloadedmetadata = () => {
          mediaElement.play()
            .then(() => {
              setIsAvatarConnected(true);
              console.log(`WebRTC ${event.track.kind} channel connected`);
            })
            .catch(error => console.error('Playback failed:', error));
        };
      } else {
        // Audio element specific setup
        mediaElement.muted = false;
        mediaElement.onloadedmetadata = () => {
          mediaElement.play()
            .catch(error => console.error('Audio playback failed:', error));
        };
      }
    } catch (error) {
      console.error(`Failed to set ${event.track.kind} stream:`, error);
    }
  }, [setIsAvatarConnected]);

  const startSession = useCallback(async (configuration: RTCConfiguration) => {
    try {
      const newPeerConnection = new RTCPeerConnection({
        iceServers: [{
          urls: configuration.urls,
          username: configuration.username,
          credential: configuration.credential,
        }]
      });

      setPeerConnection(newPeerConnection);

      // Set up event handlers
      newPeerConnection.ontrack = handleTrack;
      newPeerConnection.oniceconnectionstatechange = () => {
        const connectionState = newPeerConnection.iceConnectionState;
        console.log(`WebRTC status: ${connectionState}`);
        
        if (connectionState === 'disconnected' || connectionState === 'failed') {
          console.log("Avatar service disconnected");
        }
      };

      // Add transceivers
      newPeerConnection.addTransceiver('video', { direction: 'sendrecv' });
      newPeerConnection.addTransceiver('audio', { direction: 'sendrecv' });

      // Create data channel for events
      newPeerConnection.createDataChannel("eventChannel");

      // Initialize avatar synthesizer
      const newAvatarSynthesizer = createAvatarSynthesizer();
      setAvatarSynthesizer(newAvatarSynthesizer);

      await newAvatarSynthesizer.startAvatarAsync(newPeerConnection);
      console.log(`[${new Date().toISOString()}] Avatar started successfully`);
    } catch (error) {
      console.error('Failed to start avatar session:', error);
      setIsAvatarConnected(false);
      throw error;
    }
  }, [handleTrack, setIsAvatarConnected]);

  // Initialize avatar session
  useEffect(() => {
    const initializeAvatar = async () => {
      try {
        const config = await getAvatarConfig();
        await startSession(config);
      } catch (error) {
        console.error('Avatar initialization failed:', error);
        setIsAvatarConnected(false);
      }
    };

    initializeAvatar();

    // Cleanup function
    return () => {
      if (avatarSynthesizer) {
        avatarSynthesizer.stopSpeakingAsync()
          .then(() => {
            avatarSynthesizer.close();
          })
          .catch(console.error);
      }
      if (peerConnection) {
        peerConnection.close();
      }
      setIsAvatarConnected(false);
      console.log('WebRTC connection closed');
    };
  }, []);

  useEffect(() => {
    if (stopAvatarSpeaking && avatarSynthesizer) {
      avatarSynthesizer.stopSpeakingAsync()
        .then(() => {
          setStopAvatarSpeaking(false);
          setIsAvatarSpeaking(false);
        })
        .catch(console.error);
    }
  }, [stopAvatarSpeaking, setStopAvatarSpeaking]);

  // Handle text-to-speech
  useEffect(() => {
    if (recognisedText && avatarSynthesizer) {
      setIsAvatarSpeaking(true);
      // Convert markdown to plain text for speech while keeping markdown for display
      const speechText = markdownToSpeechText(recognisedText);
      avatarSynthesizer.speakTextAsync(speechText)
        .then(result => {
          setIsAvatarSpeaking(false);
          if (result.reason === SpeechSDK.ResultReason.SynthesizingAudioCompleted) {
            // setRecognisedText(''); // Commented out to keep text visible
          }
        })
        .catch(error => {
          console.error('Speech synthesis failed:', error);
          setIsAvatarSpeaking(false);
        });
    }
  }, [recognisedText, avatarSynthesizer, setIsAvatarSpeaking, setRecognisedText]);

  return (
    <Card shadow="none" p={0}>
      <Card.Section m="0 auto"> 
        {!isAvatarConnected && <Center><Image src="/staticAvatar.png" w={320} /></Center>}
        <video
          controls
          ref={myAvatarVideoEleRef}
          playsInline
          style={{
            display: isAvatarConnected ? 'block' : 'none',
            maxWidth: '100%',
            height: 'auto'
          }}
        />
        <audio
          ref={myAvatarAudioEleRef}
          style={{ display: 'none' }}
        />
      </Card.Section>
    </Card>
  );
};
//{!isAvatarConnected && <Center><Loader color="blue" type="bars" size="md" m="lg" /></Center>}