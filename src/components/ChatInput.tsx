// Libraries
import { useEffect } from 'react'
import { AudioConfig, SpeechConfig, SpeechRecognizer, ResultReason, CancellationReason, PropertyId, AutoDetectSourceLanguageConfig } from 'microsoft-cognitiveservices-speech-sdk';

// Components
import { ActionIcon, Paper, Grid, TextInput, Loader } from '@mantine/core';
import AudioVisualizer from './AudioVisualizer';

// Hooks
import { useAvatar } from '../hooks/useAvatar';
import { useShallow } from 'zustand/react/shallow';

// Styles
import { IconMicrophone, IconSquareFilled } from '@tabler/icons-react';

// Avatar Details
const cognitiveServicesRegion = import.meta.env.VITE_COGNITIVE_SERVICES_REGION;
const cognitiveServicesKey = import.meta.env.VITE_COGNITIVE_SERVICES_KEY;

// Azure OpenAI Details
const azureOpenAIEndpoint = import.meta.env.VITE_AZURE_OPENAI_ENDPOINT;
const azureOpenAIApiKey = import.meta.env.VITE_AZURE_OPENAI_API_KEY;
const azureOpenAIDeploymentName = import.meta.env.VITE_AZURE_OPENAI_DEPLOYMENT_NAME;
const azureOpenAIUserPrompt = import.meta.env.VITE_AZURE_OPENAI_USER_PROMPT;
// Configuration now loaded from JSON files with environment variable fallbacks

// Import configuration files
import dataSourcesConfig from '../config/dataSources.json';
import dataSourceMetadataConfig from '../config/dataSourceMetadata.json';

// Template processing function to replace ${VAR_NAME} with environment variables
function processTemplate(template: any): any {
  const templateStr = JSON.stringify(template);
  const processed = templateStr.replace(/\$\{([^}]+)\}/g, (match, envVar) => {
    const value = import.meta.env[envVar];
    if (!value) {
      console.warn(`Environment variable ${envVar} not found, keeping placeholder`);
      return match; // Keep the placeholder if env var missing
    }
    return value;
  });
  return JSON.parse(processed);
}

// Load data sources with environment variable fallback
const allDataSources = (() => {
  try {
    // First try environment variable for deployment flexibility
    if (import.meta.env.VITE_AZURE_OPENAI_DATA_SOURCES) {
      const jsonString = import.meta.env.VITE_AZURE_OPENAI_DATA_SOURCES.trim();
      const parsed = JSON.parse(jsonString);
      return parsed;
    } else {
      // Use JSON config file with template processing
      return processTemplate(dataSourcesConfig);
    }
  } catch (error) {
    console.warn('Failed to parse environment data sources, using config file:', error);
    return processTemplate(dataSourcesConfig);
  }
})();

// Load data source metadata with environment variable fallback
const dataSourceMetadata = (() => {
  try {
    // First try environment variable for deployment flexibility
    if (import.meta.env.VITE_AZURE_OPENAI_DATA_SOURCE_METADATA) {
      const jsonString = import.meta.env.VITE_AZURE_OPENAI_DATA_SOURCE_METADATA.trim();
      const parsed = JSON.parse(jsonString);
      return parsed;
    } else {
      // Use JSON config file
      return dataSourceMetadataConfig;
    }
  } catch (error) {
    console.warn('Failed to parse environment metadata, using config file:', error);
    return dataSourceMetadataConfig;
  }
})();

// System prompt with fallback default
const azureOpenAISystemPrompt = import.meta.env.VITE_AZURE_OPENAI_SYSTEM_PROMPT || 'You are an AI assistant that helps people find information. \n\n- **DO NOT** include any citations, references, or doc links. \n- Only provide a brief response in 1 to 2 sentences unless asked otherwise.';

// Routing LLM function to select appropriate data source
async function selectDataSource(userQuery: string): Promise<number> {
  const routingPrompt = `You are a routing assistant. Based on the user's query, select the most appropriate data source by returning ONLY the index number (0, 1, 2, etc.).

Available data sources:
${dataSourceMetadata.map((source, index) => 
  `${index}: ${source.name} - ${source.description}${source.keywords.length > 0 ? ` Keywords: ${source.keywords.join(', ')}` : ''}`
).join('\n')}

User query: "${userQuery}"

Respond with ONLY the index number of the most appropriate data source:`;

  try {
    // Use routing model (fallback to main model if not specified)
    const routingModel = import.meta.env.VITE_AZURE_OPENAI_ROUTING_DEPLOYMENT_NAME || import.meta.env.VITE_AZURE_OPENAI_DEPLOYMENT_NAME;
    
    console.log(`Using routing model: ${routingModel} for data source selection`);
    
    const response = await fetch(
      `${import.meta.env.VITE_AZURE_OPENAI_ENDPOINT}/openai/deployments/${routingModel}/chat/completions?api-version=2025-01-01-preview`,
      {
        method: 'POST',
        headers: {
          'api-key': import.meta.env.VITE_AZURE_OPENAI_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: routingPrompt }],
          max_tokens: 10,
          temperature: 0
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Routing LLM failed: ${response.status}`);
    }

    const data = await response.json();
    const selectedIndex = parseInt(data.choices[0].message.content.trim());
    
    // Validate index is within bounds
    if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= allDataSources.length) {
      console.warn(`Invalid routing response: ${data.choices[0].message.content}, using default index 0`);
      return 0;
    }

    console.log(`Routing LLM selected data source ${selectedIndex}: ${dataSourceMetadata[selectedIndex]?.name || 'Unknown'}`);
    return selectedIndex;
  } catch (error) {
    console.error('Error in data source routing:', error);
    return 0; // Fallback to first data source
  }
}

const useAvatarSelector = (state: any) => ({
  isListening: state.isListening,
  recognisedText: state.recognisedText,
  setIsListening: state.setIsListening,
  setRecognisedText: state.setRecognisedText,
  isAvatarSpeaking: state.isAvatarSpeaking,
  setStopAvatarSpeaking: state.setStopAvatarSpeaking,
  isAvatarConnected: state.isAvatarConnected,
});

let speechRecognizer: SpeechRecognizer;

export function ChatInput () {
  const { isListening, setIsListening, setRecognisedText, isAvatarSpeaking, setStopAvatarSpeaking, isAvatarConnected } = useAvatar(useShallow(useAvatarSelector));

  useEffect(() => {
    const enableMedia = async () => {
      try {
        createRecognizer()
      } catch (err) {
        console.log(err)
      }
    }

    enableMedia();
  }, []);

  const startListening = () => {
    speechRecognizer.startContinuousRecognitionAsync()
    setIsListening(true)
  };

  const stopListening = () => {
    speechRecognizer.stopContinuousRecognitionAsync();
    setIsListening(false);
  };

  const createRecognizer = () => {
    const speechConfig = SpeechConfig.fromSubscription(cognitiveServicesKey, cognitiveServicesRegion)
    speechConfig.setProperty(PropertyId.SpeechServiceConnection_LanguageIdMode, "Continuous")

    const autoDetectSourceLanguageConfig = AutoDetectSourceLanguageConfig.fromLanguages(['en-US','es-ES', 'es-MX'])
    speechRecognizer = SpeechRecognizer.FromConfig(speechConfig, autoDetectSourceLanguageConfig, AudioConfig.fromDefaultMicrophoneInput())

    speechRecognizer.recognized = (_s: any, e: any) => {
      if (e.result.reason === ResultReason.RecognizedSpeech) {
        handleUserQuery(e.result.text);
        stopListening();
      } else if (e.result.reason === ResultReason.NoMatch) {
        console.log("NOMATCH: Speech could not be recognized.")
        stopListening();
      }
    }

    speechRecognizer.canceled = (_s: any, e: any) => {
      console.log(`CANCELED: Reason=${e.reason}`)

      if (e.reason === CancellationReason.Error) {
        console.log(`"CANCELED: ErrorCode=${e.errorCode}`)
        console.log(`"CANCELED: ErrorDetails=${e.errorDetails}`)
        console.log("CANCELED: Did you set the speech resource key and region values?")
      }
      stopListening();
    }

    speechRecognizer.sessionStopped = () => {
      stopListening();
    }
  }

  async function handleUserQuery (userQuery: string) {
    setRecognisedText('One moment please...');

    try {
      // Step 1: Route the query to select appropriate data source
      const selectedDataSourceIndex = await selectDataSource(userQuery);
      const selectedDataSource = [allDataSources[selectedDataSourceIndex]]; // Wrap in array for API

      // Step 2: Make the actual chat completion call with selected data source
      const messages = [
        {
          role: 'system',
          content: azureOpenAISystemPrompt
        },
        {
          role: 'user',
          content: userQuery
        }
      ];

      const requestPayload = {
          data_sources: selectedDataSource,
          messages: messages,
          stream: false
      };

      const url = azureOpenAIEndpoint + "/openai/deployments/" + azureOpenAIDeploymentName + "/chat/completions?api-version=2025-01-01-preview"
      const body = JSON.stringify(requestPayload)

      const response = await fetch(url, {
          method: 'POST',
          headers: {
              'api-key': azureOpenAIApiKey,
              'Content-Type': 'application/json'
          },
          body: body
      });

      const azureOpenAIEResponse = (await response.json())
      
      if (azureOpenAIEResponse.error) {
          console.error('Azure OpenAI Error:', azureOpenAIEResponse.error);
          setRecognisedText('Sorry, there was an error processing your request.');
          return;
      }

      if (!azureOpenAIEResponse.choices || azureOpenAIEResponse.choices.length === 0) {
          console.error('No choices in response:', azureOpenAIEResponse);
          setRecognisedText('Sorry, no response was generated.');
          return;
      }

      const assistantMessage = azureOpenAIEResponse.choices[0].message;
      setRecognisedText(assistantMessage.content);
      
    } catch (error) {
      console.error('Error in handleUserQuery:', error);
      setRecognisedText('Sorry, there was an error processing your request.');
    }
  }

  return (
    <Paper radius="xl" p={0} withBorder>
      <Grid>
      <Grid.Col span="auto">
        {(isListening) ?
          <AudioVisualizer />
          :
          <TextInput 
            id="chat-text-input"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleUserQuery(event.currentTarget.value);
                event.currentTarget.value = '';
              }
            }}
            placeholder={isAvatarSpeaking ? 'Speaking...' : azureOpenAIUserPrompt} 
            pl={8} 
            variant="unstyled"
            aria-label={azureOpenAIUserPrompt}
            disabled={isAvatarSpeaking}
          />
        }
      </Grid.Col>
      <Grid.Col span="content">
        <ActionIcon 
          variant="outline" 
          radius="xl" 
          m={4} 
          disabled={!isAvatarConnected} 
          color={(isListening || isAvatarSpeaking) ? 'red' : 'blue'}
          aria-label={
            !isAvatarConnected 
              ? 'Avatar is connecting, please wait'
              : isListening 
                ? 'Stop listening and cancel voice input'
                : isAvatarSpeaking 
                  ? 'Stop avatar from speaking'
                  : 'Start voice input to ask a question'
          }
        >
          {(isListening || isAvatarSpeaking) ?
            <IconSquareFilled 
              style={{ width: '70%', height: '70%' }} 
              color="red" 
              stroke={1.5} 
              onClick={() => { stopListening(); setStopAvatarSpeaking(true); }} 
            />
            : !isAvatarConnected ?
            <Loader color="blue" type="dots" size="xs" />
            :
            <IconMicrophone 
              style={{ width: '70%', height: '70%' }} 
              stroke={1.5} 
              onClick={() => startListening()} 
            />
          }
        </ActionIcon>
      </Grid.Col>
    </Grid>
    </Paper>
  );
}