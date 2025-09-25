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
const azureOpenAIEmbeddingDeploymentName = import.meta.env.VITE_AZURE_OPENAI_EMBEDDING_DEPLOYMENT_NAME;
const azureOpenAIApiKey = import.meta.env.VITE_AZURE_OPENAI_API_KEY;
const azureOpenAIDeploymentName = import.meta.env.VITE_AZURE_OPENAI_DEPLOYMENT_NAME;
// Azure AI Search Details
const azureAISearchEndpoint = import.meta.env.VITE_AI_SEARCH_ENDPOINT;
const azureAISearchApiKey = import.meta.env.VITE_AI_SEARCH_API_KEY;
const azureAISearchIndexName = import.meta.env.VITE_AI_SEARCH_INDEX;
const azureAISearchSemanticConfiguration = import.meta.env.VITE_AI_SEARCH_SEMANTIC_CONFIGURATION;
const azureAISearchQueryType = import.meta.env.VITE_AI_SEARCH_QUERY_TYPE;
const azureAISearchTopNDocuments = parseInt(import.meta.env.VITE_AI_SEARCH_TOP_N_DOCUMENTS || '20');
const azureAISearchEmbeddingDimensions = parseInt(import.meta.env.VITE_AI_SEARCH_EMBEDDING_DIMENSIONS || '3072');

// Fields mapping with fallback default
const defaultFieldsMapping = {
  content_fields_separator: '\n',
  content_fields: ['chunk'],
  filepath_field: null,
  title_field: 'title',
  url_field: null,
  vector_fields: ['text_vector']
};

const azureAISearchFieldsMapping = (() => {
  try {
    return import.meta.env.VITE_AI_SEARCH_FIELDS_MAPPING 
      ? JSON.parse(import.meta.env.VITE_AI_SEARCH_FIELDS_MAPPING)
      : defaultFieldsMapping;
  } catch {
    return defaultFieldsMapping;
  }
})();

// System prompt with fallback default
const azureOpenAISystemPrompt = import.meta.env.VITE_AZURE_OPENAI_SYSTEM_PROMPT || 'You are an AI assistant that helps people find information. \n\n- **DO NOT** include any citations, references, or doc links. \n- Only provide a brief response in 1 to 2 sentences unless asked otherwise.';

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

    const dataSources = [{
      type: 'azure_search',
      parameters: {
        endpoint: azureAISearchEndpoint,
        authentication: {
          type: 'api_key',
          key: azureAISearchApiKey,
        },
        index_name: azureAISearchIndexName,
        semantic_configuration: azureAISearchSemanticConfiguration,
        query_type: azureAISearchQueryType,
        fields_mapping: azureAISearchFieldsMapping,
        top_n_documents: azureAISearchTopNDocuments,
        in_scope: true,
        embedding_dependency: {
          type: 'deployment_name',
          deployment_name: azureOpenAIEmbeddingDeploymentName,
          ...(azureAISearchEmbeddingDimensions > 0 && { dimensions: azureAISearchEmbeddingDimensions }),
        }
      }
    }]

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

    const url = azureOpenAIEndpoint + "/openai/deployments/" + azureOpenAIDeploymentName + "/chat/completions?api-version=2025-01-01-preview"
    const body = JSON.stringify({
        data_sources: dataSources,
        messages: messages,
        stream: false
    })

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'api-key': azureOpenAIApiKey,
            'Content-Type': 'application/json'
        },
        body: body
    });

    const azureOpenAIEResponse = (await response.json())
    const assistantMessage = azureOpenAIEResponse.choices[0].message;
    setRecognisedText(assistantMessage.content);
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
            placeholder={isAvatarSpeaking ? 'Speaking...' : 'Ask a question about Delaware State Parks'} 
            pl={8} 
            variant="unstyled"
            aria-label="Ask a question about Delaware State Parks"
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