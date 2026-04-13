import express from "express";
import serverless from "serverless-http";
import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// API Route for Article Generation
app.post("/api/generate-article", async (req, res) => {
  const { title, category } = req.body;

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({ error: "GROQ_API_KEY not configured" });
  }

  try {
    console.log(`[Groq] Iniciando geração para: "${title}" na categoria "${category}"`);
    
    const prompt = `
      Você é um redator sênior especialista em SEO e Marketing de Conteúdo Digital.
      Sua tarefa é criar um conteúdo de alta qualidade em PORTUGUÊS (Brasil) baseado no vídeo: "${title}" (Categoria: ${category}).

      Retorne um objeto JSON com EXATAMENTE estas chaves:
      1. "summary": Um resumo executivo da transcrição do vídeo, destacando os pontos principais de forma didática (mínimo 150 palavras).
      2. "seoArticle": Um artigo de blog completo, otimizado para SEO, com 600 a 800 palavras. 
         - Use títulos H2 e H3 atraentes.
         - Use listas (bullet points) para facilitar a leitura.
         - Aplique técnicas de copywriting (AIDA ou PAS).
         - O tom deve ser profissional e informativo.
      3. "keywords": Um array com as 10 melhores palavras-chave para este conteúdo.

      IMPORTANTE: Responda APENAS o JSON puro, sem textos explicativos antes ou depois.
    `;

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "Você é um assistente que gera apenas saídas em formato JSON válido em Português.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      model: "llama-3.3-70b-versatile",
      response_format: { type: "json_object" },
      temperature: 0.7,
    });

    const content = chatCompletion.choices[0]?.message?.content;
    
    if (!content) {
      console.error("[Groq] Resposta vazia recebida.");
      throw new Error("A IA não retornou nenhum conteúdo. Tente novamente.");
    }

    console.log("[Groq] Resposta recebida com sucesso. Tamanho:", content.length);
    
    try {
      const parsedData = JSON.parse(content);
      // Validação básica da estrutura
      if (!parsedData.summary || !parsedData.seoArticle) {
        throw new Error("A resposta da IA veio incompleta. Por favor, tente gerar novamente.");
      }
      res.json(parsedData);
    } catch (parseError) {
      console.error("[Groq] Erro ao parsear JSON:", content);
      throw new Error("Erro ao processar a resposta da IA. O formato retornado foi inválido.");
    }
  } catch (error: any) {
    console.error("[Groq] Erro na geração:", error);
    const errorMessage = error?.response?.data?.error?.message || error?.message || "Erro desconhecido na API da Groq.";
    res.status(500).json({ 
      error: errorMessage 
    });
  }
});

// Export the handler for Netlify
export const handler = serverless(app);
