
import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

async function test() {
    try {
        console.log("OpenAI Testi Başlatılıyor...");
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: "Sadece 'BAŞARILI' yaz." }],
            max_tokens: 5,
        });
        console.log("Sonuç:", response.choices[0].message.content);
    } catch (error) {
        console.error("OpenAI Hatası:", error.message);
    }
}

test();
