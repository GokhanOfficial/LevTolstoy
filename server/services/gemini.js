const config = require('../config');
const { getPromptForMimeType, getMultiFilePrompt } = require('../utils/prompts');

// Default Gemini API base URL
const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * Get the API base URL
 */
function getBaseUrl() {
    return config.gemini.baseUrl || DEFAULT_BASE_URL;
}

/**
 * Tek dosyayı markdown formatına dönüştürür
 * @param {Buffer} fileBuffer - Dosya içeriği
 * @param {string} mimeType - Dosya MIME tipi
 * @param {string} model - Gemini model name
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
 * Birden fazla dosyayı tek bir API çağrısı ile markdown'a dönüştürür
 * @param {Array<{buffer: Buffer, mimeType: string, name: string}>} files - Dosya dizisi
 * @param {string} model - Gemini model name
 * @returns {Promise<string>} - Birleşik markdown içeriği
 */
async function convertMultipleToMarkdown(files, model = 'gemini-3-flash-preview') {
    if (!config.gemini.apiKey) {
        throw new Error('GEMINI_API_KEY tanımlanmamış');
    }

    const baseUrl = getBaseUrl();
    const endpoint = `${baseUrl}/models/${model}:generateContent?key=${config.gemini.apiKey}`;

    // Tek dosya mı yoksa çoklu mu?
    const isMultiple = files.length > 1;
    const prompt = isMultiple ? getMultiFilePrompt() : getPromptForMimeType();

    // Parts dizisini oluştur - tüm dosyalar + prompt
    const parts = [];

    // Tüm dosyaları ekle
    for (const file of files) {
        parts.push({
            inlineData: {
                mimeType: file.mimeType,
                data: file.buffer.toString('base64')
            }
        });
    }

    // Prompt'u en sona ekle
    parts.push({
        text: prompt
    });

    const requestBody = {
        contents: [
            {
                parts: parts
            }
        ],
        generationConfig: {
            temperature: 0.1,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 65536
        }
    };

    console.log(`🤖 Gemini API: ${baseUrl} | Model: ${model} | Dosya sayısı: ${files.length}`);

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || response.statusText;
        throw new Error(`Gemini API hatası: ${errorMessage}`);
    }

    const data = await response.json();

    // Extract text from response
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
        throw new Error('Gemini API boş yanıt döndürdü');
    }

    // Markdown kod bloğu sarmalayıcısını temizle
    let cleanText = text.replace(/^```markdown\n?/i, '').replace(/\n?```$/i, '');

    return cleanText.trim();
}

/**
 * Generate a descriptive filename from markdown content using Gemini
 * @param {string} markdown - Markdown content
 * @param {string} model - Gemini model name
 * @returns {Promise<string>} - Generated filename (without extension)
 */
async function generateFilename(markdown, model = 'gemini-2.0-flash') {
    if (!config.gemini.apiKey) {
        throw new Error('GEMINI_API_KEY tanımlanmamış');
    }

    const baseUrl = getBaseUrl();
    const endpoint = `${baseUrl}/models/${model}:generateContent?key=${config.gemini.apiKey}`;

    // Use first 5000 chars of markdown for context (to keep request small)
    const contentSample = markdown.substring(0, 5000);

    const prompt = `Aşağıdaki markdown içeriği için kısa ve açıklayıcı bir dosya adı oluştur.

Kurallar:
- Sadece dosya adını yaz, uzantı ekleme
- Türkçe karakterler kullanabilirsin (ş, ğ, ü, ö, ç, ı)
- Maksimum 50 karakter
- Boşluk yerine tire (-) kullan
- Özel karakterler kullanma (sadece harf, rakam ve tire)
- İçeriğin ana konusunu yansıtsın

İçerik:
${contentSample}

Dosya adı:`;

    const requestBody = {
        contents: [
            {
                parts: [{ text: prompt }]
            }
        ],
        generationConfig: {
            temperature: 0.3,
            topP: 0.8,
            topK: 40,
            maxOutputTokens: 2000
        }
    };

    console.log(`🏷️ Dosya adı üretiliyor (Gemini)...`);

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || response.statusText;
        throw new Error(`Gemini API hatası: ${errorMessage}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

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
}

module.exports = {
    convertToMarkdown,
    convertMultipleToMarkdown,
    generateFilename
};
