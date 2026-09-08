export const isAIAssistantDisabled = process.env.NEXT_PUBLIC_DISABLE_AI_ASSISTANT === 'true';

export const AI_ASSISTANT_SETUP_HINT = 'Set NEXT_PUBLIC_DISABLE_AI_ASSISTANT=false and OPENAI_API_KEY in .env.local, then restart the app.';

export const AI_ASSISTANT_ENV_SNIPPET = [
  'NEXT_PUBLIC_DISABLE_AI_ASSISTANT=false',
  'OPENAI_API_KEY=your-openai-api-key',
  'OPENAI_MODEL=gpt-4o-mini'
];
