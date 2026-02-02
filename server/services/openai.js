const OpenAI = require('openai');
const config = require('../config');
const { getPromptForMimeType, getMultiFilePrompt, getFilenamePrompt, getSummarizePrompt } = require('../utils/prompts');

// Default OpenAI API base URL
const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

/**
 * Get the API base URL
 */
function getBaseUrl() {
    return config.openai.baseUrl || DEFAULT_BASE_URL;
}

/**
 * Create OpenAI client instance
 */
function createClient() {
    return new OpenAI({
        apiKey: config.openai.apiKey,
        baseURL: getBaseUrl()
    });
}

/**
 * Tek dosyayı markdown formatına dönüştürür
 * @param {Buffer} fileBuffer - Dosya içeriği
 * @param {string} mimeType - Dosya MIME tipi
 * @param {string} model - Model name
 * @returns {Promise<string>} - Markdown içeriği
 */
async function convertToMarkdown(fileBuffer, mimeType, model) {
    return convertMultipleToMarkdown([{
        buffer: fileBuffer,
        mimeType: mimeType,
        name: 'file'
    }], model);
}

/**
 * Get OpenAI content type from MIME type
 * @param {string} mimeType - MIME tipi
 * @returns {string} - OpenAI content type ('image_url' or 'input_audio')
 */
function getOpenAIContentType(mimeType) {
    if (mimeType.startsWith('audio/')) {
        return 'input_audio';
    }
    // Images and PDFs use image_url type
    return 'image_url';
}

/**
 * Get audio format from MIME type
 * @param {string} mimeType - Audio MIME tipi
 * @returns {string} - Audio format (wav, mp3)
 */
function getAudioFormat(mimeType) {
    if (mimeType.includes('wav')) return 'wav';
    if (mimeType.includes('mp3') || mimeType.includes('mpeg')) return 'mp3';
    return 'wav'; // default
}

/**
 * Birden fazla dosyayı tek bir API çağrısı ile markdown'a dönüştürür
 * @param {Array<{buffer: Buffer, mimeType: string, name: string}>} files - Dosya dizisi
 * @param {string} model - Model name
 * @param {function} onChunk - Callback function for streaming chunks
 * @returns {Promise<string>} - Birleşik markdown içeriği
 */
async function convertMultipleToMarkdown(files, model = 'gpt-4o', onChunk = null) {
    if (!config.openai.apiKey) {
        throw new Error('OPENAI_API_KEY tanımlanmamış');
    }

    const client = createClient();

    // Tek dosya mı yoksa çoklu mu?
    const isMultiple = files.length > 1;
    const prompt = isMultiple ? getMultiFilePrompt() : getPromptForMimeType();

    // Build content array with all files
    const content = [];

    for (const file of files) {
        const contentType = getOpenAIContentType(file.mimeType);

        if (contentType === 'input_audio') {
            // Audio files always use base64 (input_audio format)
            const base64Data = file.buffer.toString('base64');
            content.push({
                type: 'input_audio',
                input_audio: {
                    data: base64Data,
                    format: getAudioFormat(file.mimeType)
                }
            });
        } else {
            // Image/PDF - prefer URL if available, fallback to base64
            if (file.s3Url) {
                // Use S3 URL directly (faster, less memory)
                content.push({
                    type: 'image_url',
                    image_url: {
                        url: file.s3Url
                    }
                });
                console.log(`📎 Dosya URL ile gönderiliyor: ${file.name || 'file'}`);
            } else {
                // Fallback to base64 data URI
                const base64Data = file.buffer.toString('base64');
                content.push({
                    type: 'image_url',
                    image_url: {
                        url: `data:${file.mimeType};base64,${base64Data}`
                    }
                });
            }
        }
    }

    // Add prompt text at the end
    content.push({
        type: 'text',
        text: prompt
    });

    const messages = [
        {
            role: 'user',
            content: content
        }
    ];

    console.log(`🤖 OpenAI API (Stream): ${getBaseUrl()} | Model: ${model} | Dosya sayısı: ${files.length}`);

    try {
        const stream = await client.chat.completions.create({
            model: model,
            messages: messages,
            stream: true,
            temperature: 0.1,
            top_p: 0.95
        });

        let fullText = '';

        for await (const chunk of stream) {
            const textChunk = chunk.choices[0]?.delta?.content;
            if (textChunk) {
                fullText += textChunk;
                if (onChunk) onChunk(textChunk);
            }
        }

        // Markdown kod bloğu sarmalayıcısını temizle
        let cleanText = fullText.replace(/^```markdown\n?/i, '').replace(/\n?```$/i, '');

        return cleanText.trim();
    } catch (error) {
        console.error('OpenAI API hatası:', error);
        throw new Error(`OpenAI API hatası: ${error.message}`);
    }
}

/**
 * Generate a descriptive filename from markdown content
 * @param {string} markdown - Markdown content
 * @param {string} model - Model name
 * @returns {Promise<string>} - Generated filename (without extension)
 */
async function generateFilename(markdown, model = null) {
    // 1. Env'de belirtilen model (öncelikli)
    // 2. Dönüştürme için kullanılan model (parametreden gelen)
    // 3. Fallback default
    const modelToUse = config.openai.filenameModel || model || 'gpt-4o-mini';

    if (!config.openai.apiKey) {
        throw new Error('OPENAI_API_KEY tanımlanmamış');
    }

    const client = createClient();

    // For long texts, use first 4000 + last 4000 chars for better context
    let contentSample;
    if (markdown.length > 8000) {
        const first = markdown.substring(0, 4000);
        const last = markdown.substring(markdown.length - 4000);
        contentSample = `${first}\n\n[...]\n\n${last}`;
    } else {
        contentSample = markdown;
    }

    const prompt = `${getFilenamePrompt()}
${contentSample}

Dosya adı:`;

    console.log(`🏷️ Dosya adı üretiliyor (OpenAI) | Model: ${modelToUse}...`);

    try {
        const response = await client.chat.completions.create({
            model: modelToUse,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.3,
            max_tokens: 2000,
            top_p: 0.8
        });

        const text = response.choices[0]?.message?.content;

        if (!text) {
            throw new Error('Dosya adı üretilemedi');
        }

        // Clean and sanitize the filename
        let filename = text.trim()
            .replace(/```/g, '')
            .replace(/\n/g, '')
            .trim()
            .substring(0, 50);

        // Replace spaces with dashes, remove invalid chars (keep Turkish letters)
        filename = filename
            .replace(/\s+/g, '-')
            .replace(/[^a-zA-Z0-9\u00C0-\u024F\u1E00-\u1EFF-]/g, '') // Keep letters, numbers, dashes
            .replace(/-+/g, '-') // Remove multiple dashes
            .replace(/^-|-$/g, ''); // Remove leading/trailing dashes

        console.log(`✅ Dosya adı üretildi: ${filename}`);

        return filename || 'document';
    } catch (error) {
        console.error('Dosya adı üretme hatası:', error);
        throw new Error(`Dosya adı üretme hatası: ${error.message}`);
    }
}

/**
 * Summarize text using OpenAI API with streaming support
 * @param {string} text - Text to summarize
 * @param {string} model - Model name
 * @param {function} onChunk - Callback function for streaming chunks
 * @returns {Promise<string>} - Complete summary
 */
async function summarizeText(text, model = 'gpt-4o', onChunk = null) {
    if (!config.openai.apiKey) {
        throw new Error('OPENAI_API_KEY tanımlanmamış');
    }

    const client = createClient();

    const prompt = `${getSummarizePrompt()}

${text}`;

    console.log(`📝 OpenAI API Özetleme (Stream): ${getBaseUrl()} | Model: ${model}`);

    try {
        const stream = await client.chat.completions.create({
            model: model,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
            stream: true,
            temperature: 0.3,
            top_p: 0.95
        });

        let fullText = '';

        for await (const chunk of stream) {
            const textChunk = chunk.choices[0]?.delta?.content;
            if (textChunk) {
                fullText += textChunk;
                if (onChunk) onChunk(textChunk);
            }
        }

        // Cleanup markdown code blocks if present
        let cleanSummary = fullText.replace(/^```markdown\n?/i, '').replace(/\n?```$/i, '');
        return cleanSummary.trim();
    } catch (error) {
        console.error('Özetleme hatası:', error);
        throw new Error(`Özetleme hatası: ${error.message}`);
    }
}

module.exports = {
    convertToMarkdown,
    convertMultipleToMarkdown,
    generateFilename,
    summarizeText
};
