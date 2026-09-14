import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const apiKey = process.env.OPENAI_API_KEY || '';
const defaultModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';

let openaiClient = null;
if (apiKey && apiKey !== 'your_openai_api_key_here') {
  openaiClient = new OpenAI({ apiKey });
}

export const SYSTEM_PROMPT = `You are VakSetu AI, an advanced, highly capable AI assistant integrated directly into VakSetu.
You specialize in:
- Writing, reviewing, and explaining clean, modern code (JavaScript, Python, React, Node.js, HTML/CSS, SQL, etc.).
- Formatting code in proper markdown syntax with language tags (e.g. \`\`\`javascript, \`\`\`python).
- Summarizing discussions, polishing emails, and drafting professional communications.
- Answering complex technical and general inquiries with clarity and structured bullet points.
- Maintaining an encouraging, professional, and concise tone.`;

/**
 * Generates an intelligent contextual simulated response when OpenAI API key is not configured.
 */
export const generateContextualFallback = (lastUserMessage) => {
  const query = (lastUserMessage || '').toLowerCase();

  if (query.includes('hello') || query.includes('hi') || query.includes('hey')) {
    return `Hello! 👋 I'm **VakSetu AI**, your built-in AI assistant.\n\nI can help you with:\n- **Writing & Debugging Code**\n- **Explaining Complex Concepts**\n- **Refining and Translating Messages**\n- **Summarizing Conversations**\n\nWhat would you like to explore today?`;
  }

  if (query.includes('react') || query.includes('hook') || query.includes('component')) {
    return `Here is a clean example of a custom React hook with state and effects:\n\n\`\`\`javascript
import { useState, useEffect } from 'react';

export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}
\`\`\`\n\n### Why this helps:\n1. **Performance**: Reduces unnecessary API calls or re-renders.\n2. **Clean separation**: Isolates timer management logic from component rendering.\n3. **Reusable**: Easily imported across multiple search inputs or form fields.`;
  }

  if (query.includes('code') || query.includes('javascript') || query.includes('python') || query.includes('function')) {
    return `Here is a robust algorithm implementation for finding unique items in an array with frequency tracking:\n\n\`\`\`javascript
function analyzeFrequency(items) {
  const counts = new Map();
  for (const item of items) {
    counts.set(item, (counts.get(item) || 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
}

// Example usage:
const data = ['react', 'node', 'mongodb', 'react', 'socket.io', 'react'];
console.log(analyzeFrequency(data));
// Output: [ ['react', 3], ['node', 1], ['mongodb', 1], ['socket.io', 1] ]
\`\`\`\n\nLet me know if you would like me to optimize or adapt this for your specific use case!`;
  }

  return `I have analyzed your prompt:\n\n> *"${lastUserMessage}"*\n\n### Key Takeaways:\n1. **Structured Architecture**: Ensure loose coupling between service layers and presentation components.\n2. **Real-Time Responsiveness**: Leverage WebSockets and streaming protocols for instant user feedback.\n3. **Resilience**: Implement graceful fallbacks and clear error handling for external dependencies.\n\nFeel free to ask follow-up questions or request code examples!`;
};

/**
 * Standard non-streaming chat completion
 */
export const chatCompletion = async ({
  messages = [],
  model = defaultModel,
  temperature = 0.7,
  maxTokens = 1500,
}) => {
  const formattedMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages.map((m) => ({
      role: m.role || (m.sender?._id === 'ai' ? 'assistant' : 'user'),
      content: m.content || m.text || '',
    })),
  ];

  if (openaiClient) {
    try {
      const response = await openaiClient.chat.completions.create({
        model,
        messages: formattedMessages,
        temperature,
        max_tokens: maxTokens,
      });

      const content = response.choices[0]?.message?.content || '';
      return {
        success: true,
        content,
        model: response.model,
        usage: response.usage,
      };
    } catch (err) {
      console.warn('[OpenAI API Warning - falling back to local intelligence]:', err.message);
    }
  }

  // Fallback
  const lastUserMsg = messages[messages.length - 1]?.text || messages[messages.length - 1]?.content || '';
  const fallbackText = generateContextualFallback(lastUserMsg);

  return {
    success: true,
    content: fallbackText,
    model: `${defaultModel} (simulated)`,
    usage: { prompt_tokens: 25, completion_tokens: 80, total_tokens: 105 },
  };
};

/**
 * Streaming chat completion with onChunk callback
 */
export const streamChatCompletion = async ({
  messages = [],
  model = defaultModel,
  temperature = 0.7,
  maxTokens = 1500,
  onChunk = () => {},
  onDone = () => {},
  onError = () => {},
}) => {
  const formattedMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages.map((m) => ({
      role: m.role || (m.sender?._id === 'ai' ? 'assistant' : 'user'),
      content: m.content || m.text || '',
    })),
  ];

  if (openaiClient) {
    try {
      const stream = await openaiClient.chat.completions.create({
        model,
        messages: formattedMessages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
      });

      let fullText = '';
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content || '';
        if (delta) {
          fullText += delta;
          onChunk(delta);
        }
      }
      onDone(fullText);
      return fullText;
    } catch (err) {
      console.warn('[OpenAI Stream Warning - streaming simulated response]:', err.message);
    }
  }

  // Fallback streaming simulation
  const lastUserMsg = messages[messages.length - 1]?.text || messages[messages.length - 1]?.content || '';
  const fallbackText = generateContextualFallback(lastUserMsg);

  const words = fallbackText.split(' ');
  let accumulated = '';
  let index = 0;

  const interval = setInterval(() => {
    if (index < words.length) {
      const word = words[index] + (index < words.length - 1 ? ' ' : '');
      accumulated += word;
      onChunk(word);
      index++;
    } else {
      clearInterval(interval);
      onDone(accumulated);
    }
  }, 25);

  return fallbackText;
};

/**
 * AI Message Rewriter (Professional, Casual, Concise, Fix Grammar)
 */
export const rewriteMessage = async ({ text, style = 'professional' }) => {
  if (!text || !text.trim()) {
    return { success: false, message: 'Text is required for rewriting' };
  }

  const styleInstructions = {
    professional: 'Rewrite the message to sound polite, professional, and business-ready. Maintain the core meaning without unnecessary corporate jargon. Return ONLY the rewritten text.',
    casual: 'Rewrite the message to sound relaxed, warm, and conversational. Return ONLY the rewritten text.',
    concise: 'Rewrite the message to be brief, direct, and free of redundant words. Return ONLY the rewritten text.',
    fix_grammar: 'Correct any spelling, punctuation, or grammatical errors while strictly preserving the original tone and phrasing. Return ONLY the corrected text.',
  };

  const instruction = styleInstructions[style] || styleInstructions.professional;

  if (openaiClient) {
    try {
      const response = await openaiClient.chat.completions.create({
        model: defaultModel,
        messages: [
          { role: 'system', content: instruction },
          { role: 'user', content: text },
        ],
        temperature: 0.5,
        max_tokens: 500,
      });

      const rewritten = response.choices[0]?.message?.content?.trim() || text;
      return { success: true, result: rewritten, style };
    } catch (err) {
      console.warn('[OpenAI Rewrite Warning - fallback used]:', err.message);
    }
  }

  // Fallback rewriter
  let fallbackResult = text.trim();
  if (style === 'professional') {
    fallbackResult = `Dear team, I would like to bring to your attention that ${text.charAt(0).toLowerCase() + text.slice(1)}. Please let me know your thoughts at your earliest convenience.`;
  } else if (style === 'casual') {
    fallbackResult = `Hey! Just wanted to share: ${text.toLowerCase()} 😊`;
  } else if (style === 'concise') {
    fallbackResult = text.split('. ')[0] + '.';
  } else if (style === 'fix_grammar') {
    fallbackResult = text.charAt(0).toUpperCase() + text.slice(1);
    if (!fallbackResult.endsWith('.') && !fallbackResult.endsWith('!') && !fallbackResult.endsWith('?')) {
      fallbackResult += '.';
    }
  }

  return { success: true, result: fallbackResult, style };
};

/**
 * AI Message Translator
 */
export const translateMessage = async ({ text, targetLanguage = 'Spanish' }) => {
  if (!text || !text.trim()) {
    return { success: false, message: 'Text is required for translation' };
  }

  if (openaiClient) {
    try {
      const response = await openaiClient.chat.completions.create({
        model: defaultModel,
        messages: [
          {
            role: 'system',
            content: `You are an expert translator. Translate the text into ${targetLanguage}. Maintain accurate tone, idioms, and natural fluency. Return ONLY the translated text.`,
          },
          { role: 'user', content: text },
        ],
        temperature: 0.3,
        max_tokens: 600,
      });

      const translated = response.choices[0]?.message?.content?.trim() || text;
      return { success: true, translatedText: translated, targetLanguage };
    } catch (err) {
      console.warn('[OpenAI Translation Warning - fallback used]:', err.message);
    }
  }

  // Fallback translations
  const langDemos = {
    Spanish: `[Traducción al Español]: ${text}`,
    French: `[Traduction en Français]: ${text}`,
    German: `[Deutsche Übersetzung]: ${text}`,
    Japanese: `[日本語の翻訳]: ${text}`,
    Hindi: `[हिंदी अनुवाद]: ${text}`,
  };

  const translatedText = langDemos[targetLanguage] || `[${targetLanguage} Translation]: ${text}`;
  return { success: true, translatedText, targetLanguage };
};

/**
 * AI Chat Summarizer
 */
export const summarizeMessages = async ({ messages = [] }) => {
  if (!messages || messages.length === 0) {
    return { success: false, message: 'No messages provided to summarize' };
  }

  const conversationText = messages
    .filter((m) => !m.isDeleted)
    .map((m) => `${m.sender?.name || 'User'}: ${m.text || ''}`)
    .join('\n');

  if (openaiClient) {
    try {
      const response = await openaiClient.chat.completions.create({
        model: defaultModel,
        messages: [
          {
            role: 'system',
            content: `Summarize the following chat conversation into structured markdown with:
1. **Executive Summary** (2-3 concise sentences)
2. **Key Decisions & Discussion Points** (bullet points)
3. **Action Items / Next Steps** (if any)`,
          },
          { role: 'user', content: conversationText },
        ],
        temperature: 0.4,
        max_tokens: 800,
      });

      const summary = response.choices[0]?.message?.content?.trim() || '';
      return { success: true, summary };
    } catch (err) {
      console.warn('[OpenAI Summarize Warning - fallback used]:', err.message);
    }
  }

  // Fallback summary
  const summary = `### Executive Summary\nThe team discussed key updates regarding project milestones, architecture, and task coordination. Progress is advancing according to plan.\n\n### Key Decisions & Discussion Points\n- Reviewed system specifications and module structure.\n- Confirmed real-time communication protocols and message persistence.\n\n### Action Items\n- Proceed with scheduled verification and testing.`;

  return { success: true, summary };
};

/**
 * AI Contextual Smart Replies
 */
export const generateSmartReplies = async ({ messages = [] }) => {
  const recentMessages = messages
    .slice(-6)
    .map((m) => `${m.sender?.name || 'User'}: ${m.text || ''}`)
    .join('\n');

  if (openaiClient && recentMessages.trim()) {
    try {
      const response = await openaiClient.chat.completions.create({
        model: defaultModel,
        messages: [
          {
            role: 'system',
            content: `Based on the conversation, provide exactly 3 natural, polite, and quick reply suggestions (each 2-7 words). Return ONLY a JSON array of 3 strings, e.g. ["Sounds good!", "I will check this out now.", "Thanks for the update!"]`,
          },
          { role: 'user', content: recentMessages },
        ],
        temperature: 0.7,
        max_tokens: 150,
      });

      const raw = response.choices[0]?.message?.content?.trim() || '';
      const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());
      if (Array.isArray(parsed) && parsed.length > 0) {
        return { success: true, suggestions: parsed.slice(0, 3) };
      }
    } catch (err) {
      console.warn('[OpenAI Smart Replies Warning - fallback used]:', err.message);
    }
  }

  // Fallback suggestions
  return {
    success: true,
    suggestions: [
      'Sounds great, thanks!',
      'I will look into this right away.',
      'Can you provide a bit more detail?',
    ],
  };
};

export default {
  chatCompletion,
  streamChatCompletion,
  generateContextualFallback,
  rewriteMessage,
  translateMessage,
  summarizeMessages,
  generateSmartReplies,
  SYSTEM_PROMPT,
};
