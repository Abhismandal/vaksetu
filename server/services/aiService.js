import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();


/**
 * Resolves AI provider configuration from environment variables.
 * Automatically detects Groq, OpenRouter, or OpenAI, cleans quotes/slashes,
 * and chooses the appropriate default model.
 */
export const getAiConfig = () => {
  const rawKey = (
    process.env.OPENAI_API_KEY ||
    process.env.GROQ_API_KEY ||
    process.env.AI_API_KEY ||
    ''
  ).trim().replace(/^["']|["']$/g, '');

  let rawBaseUrl = (
    process.env.OPENAI_BASE_URL ||
    process.env.GROQ_BASE_URL ||
    ''
  ).trim().replace(/^["']|["']$/g, '').replace(/\/+$/, '');

  let rawModel = (
    process.env.OPENAI_MODEL ||
    process.env.GROQ_MODEL ||
    ''
  ).trim().replace(/^["']|["']$/g, '');

  // Groq auto-detection:
  // 1. Key starts with 'gsk_'
  // 2. Base URL contains 'groq.com'
  // 3. GROQ_API_KEY env variable was provided
  const isGroq =
    rawKey.startsWith('gsk_') ||
    (rawBaseUrl && rawBaseUrl.includes('groq.com')) ||
    Boolean(process.env.GROQ_API_KEY);

  if (isGroq && !rawBaseUrl) {
    rawBaseUrl = 'https://api.groq.com/openai/v1';
  }

  // Model selection:
  // For Groq: llama-3.3-70b-versatile (replaces deprecated llama-3.1-70b/llama3-8b).
  // If model is unset or set to an OpenAI model like gpt-4o-mini, use llama-3.3-70b-versatile.
  let effectiveModel = rawModel;
  if (!effectiveModel || (isGroq && (effectiveModel.includes('gpt') || effectiveModel === 'gpt-4o-mini'))) {
    effectiveModel = isGroq ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini';
  }

  const isConfigured = Boolean(rawKey && rawKey !== 'your_openai_api_key_here');
  const provider = isGroq ? 'groq' : rawBaseUrl ? 'custom' : rawKey ? 'openai' : 'local';

  return {
    apiKey: rawKey,
    baseURL: rawBaseUrl || undefined,
    model: effectiveModel,
    provider,
    isConfigured,
  };
};

/**
 * Returns an OpenAI client instance initialized with current config.
 */
export const getOpenAIClient = () => {
  const config = getAiConfig();
  if (!config.isConfigured) return null;

  return new OpenAI({
    apiKey: config.apiKey,
    ...(config.baseURL ? { baseURL: config.baseURL } : {}),
  });
};

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

  // Greetings
  if (query.includes('hello') || query.includes('hi') || query.includes('hey') || query.includes('namaste')) {
    return `Hello! 👋 I'm **VakSetu AI**, your intelligent real-time assistant.\n\nI can help you with:\n- **Writing & Debugging Code** (Java, Python, JavaScript, C++, etc.)\n- **Explaining Complex Concepts & Algorithms**\n- **Refining and Translating Messages**\n- **Summarizing Conversations**\n\nWhat would you like to explore today?`;
  }

  // Factorial Program
  if (query.includes('factorial')) {
    if (query.includes('python')) {
      return `Here is a complete **Factorial Program in Python** using both iteration and recursion:\n\n\`\`\`python
# Approach 1: Iterative
def factorial_iterative(n):
    if n < 0:
        return "Factorial does not exist for negative numbers"
    result = 1
    for i in range(2, n + 1):
        result *= i
    return result

# Approach 2: Recursive
def factorial_recursive(n):
    if n < 0:
        return "Factorial does not exist for negative numbers"
    return 1 if n <= 1 else n * factorial_recursive(n - 1)

# Example usage:
num = 5
print(f"Factorial of {num} is: {factorial_iterative(num)}")
# Output: Factorial of 5 is: 120
\`\`\`\n\n### Complexity:\n- **Time Complexity**: \\(O(n)\\)\n- **Space Complexity**: \\(O(1)\\) for iterative approach.`;
    }

    // Default to Java for factorial (or explicit Java request)
    return `Here is the complete **Factorial Program in Java** with user input handling:\n\n\`\`\`java
import java.util.Scanner;

public class FactorialProgram {
    // Recursive method
    public static long factorial(int n) {
        if (n == 0 || n == 1) {
            return 1;
        }
        return n * factorial(n - 1);
    }

    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        System.out.print("Enter a positive number: ");
        int num = scanner.nextInt();

        if (num < 0) {
            System.out.println("Error: Factorial is not defined for negative numbers.");
        } else {
            long result = 1;
            // Iterative approach
            for (int i = 1; i <= num; i++) {
                result *= i;
            }
            System.out.println("Factorial of " + num + " = " + result);
        }

        scanner.close();
    }
}
\`\`\`\n\n### How It Works:\n1. **Input**: Reads an integer from the user via \`Scanner\`.\n2. **Validation**: Checks that the number is non-negative.\n3. **Computation**: Loops from 1 to \\(n\\) multiplying the accumulator: \\(5! = 5 \\times 4 \\times 3 \\times 2 \\times 1 = 120\\).`;
  }

  // Fibonacci Series
  if (query.includes('fibonacci')) {
    return `Here is a complete **Fibonacci Series implementation in Java**:\n\n\`\`\`java
public class Fibonacci {
    public static void main(String[] args) {
        int count = 10;
        int num1 = 0, num2 = 1;

        System.out.print("First " + count + " Fibonacci numbers: ");
        for (int i = 1; i <= count; ++i) {
            System.out.print(num1 + " ");
            int sum = num1 + num2;
            num1 = num2;
            num2 = sum;
        }
    }
}
\`\`\`\n\n**Output**: \`0 1 1 2 3 5 8 13 21 34\``;
  }

  // Prime Number
  if (query.includes('prime')) {
    return `Here is a fast **Prime Number Checker in Java**:\n\n\`\`\`java
public class PrimeCheck {
    public static boolean isPrime(int n) {
        if (n <= 1) return false;
        if (n <= 3) return true;
        if (n % 2 == 0 || n % 3 == 0) return false;

        for (int i = 5; i * i <= n; i += 6) {
            if (n % i == 0 || n % (i + 2) == 0) return false;
        }
        return true;
    }

    public static void main(String[] args) {
        int number = 29;
        System.out.println(number + " is prime? " + isPrime(number));
    }
}
\`\`\``;
  }

  // Palindrome
  if (query.includes('palindrome')) {
    return `Here is a **Palindrome Checker in Java** for strings and numbers:\n\n\`\`\`java
public class PalindromeCheck {
    public static boolean isPalindrome(String str) {
        int left = 0, right = str.length() - 1;
        while (left < right) {
            if (str.charAt(left) != str.charAt(right)) return false;
            left++;
            right--;
        }
        return true;
    }

    public static void main(String[] args) {
        String test = "racecar";
        System.out.println("'" + test + "' is palindrome? " + isPalindrome(test));
    }
}
\`\`\``;
  }

  // General Java queries
  if (query.includes('java')) {
    return `Here is a clean, modern **Java 17+ Object-Oriented Example** demonstrating records, methods, and streams:\n\n\`\`\`java
import java.util.List;

public class Main {
    // Modern Java Record
    public record User(String name, String role, int activeProjects) {}

    public static void main(String[] args) {
        List<User> team = List.of(
            new User("Abhishek", "Lead Engineer", 4),
            new User("Priya", "AI Researcher", 3),
            new User("Karan", "Full-Stack Dev", 5)
        );

        System.out.println("Active contributors:");
        team.stream()
            .filter(u -> u.activeProjects() >= 4)
            .forEach(u -> System.out.println("• " + u.name() + " (" + u.role() + ")"));
    }
}
\`\`\``;
  }

  // React queries
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

  // Generic Code / JavaScript / Python
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

  return `I have analyzed your prompt:\n\n> *"${lastUserMessage}"*\n\n### 💡 Solution & Overview:\nHere is a structured breakdown addressing your query:\n\n1. **Core Concept**: Break down the task into smaller modular steps.\n2. **Best Practices**: Use clean architecture, descriptive variable naming, and proper error handling.\n3. **Scalability**: Design for high maintainability with clean interfaces.\n\n*(Note: VakSetu AI is currently running in local intelligence mode. For dynamic open-domain generation on every topic, add an \`OPENAI_API_KEY\` or free Groq key in your server environment variables!)*`;
};

/**
 * Standard non-streaming chat completion
 */
export const chatCompletion = async ({
  messages = [],
  model,
  temperature = 0.7,
  maxTokens = 1500,
}) => {
  const config = getAiConfig();
  const effectiveModel = model && model !== 'gpt-4o-mini' ? model : config.model;

  const formattedMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages.map((m) => ({
      role: m.role || (m.sender?._id === 'ai' ? 'assistant' : 'user'),
      content: m.content || m.text || '',
    })),
  ];

  if (config.isConfigured) {
    try {
      const client = getOpenAIClient();
      const response = await client.chat.completions.create({
        model: effectiveModel,
        messages: formattedMessages,
        temperature,
        max_tokens: maxTokens,
      });

      const content = response.choices[0]?.message?.content || '';
      return {
        success: true,
        content,
        model: response.model || effectiveModel,
        usage: response.usage,
      };
    } catch (err) {
      console.error(`[AI Provider (${config.provider}) Completion Error]:`, err.message);
      return {
        success: false,
        content: `⚠️ **${config.provider.toUpperCase()} API Error**: ${err.message}\n\n*Please verify your API key, model selection (\`${effectiveModel}\`), and provider settings in Render dashboard.*`,
        model: effectiveModel,
        error: err.message,
      };
    }
  }

  // Fallback (only when no key is configured)
  const lastUserMsg = messages[messages.length - 1]?.text || messages[messages.length - 1]?.content || '';
  const fallbackText = generateContextualFallback(lastUserMsg);

  return {
    success: true,
    content: fallbackText,
    model: `${effectiveModel} (simulated)`,
    usage: { prompt_tokens: 25, completion_tokens: 80, total_tokens: 105 },
  };
};

/**
 * Streaming chat completion with onChunk callback
 */
export const streamChatCompletion = async ({
  messages = [],
  model,
  temperature = 0.7,
  maxTokens = 1500,
  onChunk = () => {},
  onDone = () => {},
  onError = () => {},
}) => {
  const config = getAiConfig();
  const effectiveModel = model && model !== 'gpt-4o-mini' ? model : config.model;

  const formattedMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages.map((m) => ({
      role: m.role || (m.sender?._id === 'ai' ? 'assistant' : 'user'),
      content: m.content || m.text || '',
    })),
  ];

  if (config.isConfigured) {
    try {
      const client = getOpenAIClient();
      const stream = await client.chat.completions.create({
        model: effectiveModel,
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
      console.error(`[AI Provider (${config.provider}) Stream Error]:`, err.message);
      const errMsg = `⚠️ **${config.provider.toUpperCase()} API Error**: ${err.message}\n\n*Please verify your API key, model selection (\`${effectiveModel}\`), and provider settings in Render dashboard.*`;
      onChunk(errMsg);
      onDone(errMsg);
      return errMsg;
    }
  }

  // Fallback streaming simulation (only when no key is configured)
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
  const config = getAiConfig();

  if (config.isConfigured) {
    try {
      const client = getOpenAIClient();
      const response = await client.chat.completions.create({
        model: config.model,
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
      console.warn(`[AI Provider (${config.provider}) Rewrite Warning - fallback used]:`, err.message);
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

  const config = getAiConfig();

  if (config.isConfigured) {
    try {
      const client = getOpenAIClient();
      const response = await client.chat.completions.create({
        model: config.model,
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
      console.warn(`[AI Provider (${config.provider}) Translation Warning - fallback used]:`, err.message);
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

  const config = getAiConfig();

  if (config.isConfigured) {
    try {
      const client = getOpenAIClient();
      const response = await client.chat.completions.create({
        model: config.model,
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
      console.warn(`[AI Provider (${config.provider}) Summarize Warning - fallback used]:`, err.message);
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

  const config = getAiConfig();

  if (config.isConfigured && recentMessages.trim()) {
    try {
      const client = getOpenAIClient();
      const response = await client.chat.completions.create({
        model: config.model,
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
      console.warn(`[AI Provider (${config.provider}) Smart Replies Warning - fallback used]:`, err.message);
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
  getAiConfig,
  getOpenAIClient,
  SYSTEM_PROMPT,
};
