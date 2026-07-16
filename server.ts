import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Chat API route proxying Gemini requests safely on the server
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, history, useSearch, memories } = req.body;
      if (!message) {
        return res.status(400).json({ error: "Message is required" });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ 
          error: "GEMINI_API_KEY is missing. Please add it via Settings > Secrets." 
        });
      }

      // Initialize the Gemini client lazily to avoid crashing on start if API key is missing
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });

      // Prepare conversation contents payload
      const contents = [];
      if (history && Array.isArray(history)) {
        for (const turn of history) {
          contents.push({
            role: turn.role === "assistant" ? "model" : "user",
            parts: [{ text: turn.text }],
          });
        }
      }
      contents.push({
        role: "user",
        parts: [{ text: message }],
      });

      // Set up System Instruction containing user memories if available
      let systemInstruction = "You are a highly helpful, friendly, and intelligent conversational agent powered by Google Gemini.";
      if (memories && Array.isArray(memories) && memories.length > 0) {
        systemInstruction += "\n\nCRITICAL memory instructions: The user has permitted you to remember these facts about them across sessions. Seamlessly adapt your tone and responses to this context without explicitly repeating all these facts back to the user unless relevant:\n" +
          memories.map((m) => `- ${m}`).join("\n");
      }

      const config: any = {
        systemInstruction,
      };

      if (useSearch) {
        config.tools = [{ googleSearch: {} }];
      }

      // Request content generation with a fallback strategy and automatic retries
      // If the primary gemini-3.5-flash model experiences high demand (503),
      // we try to retry, and if needed fall back to gemini-flash-latest or gemini-3.1-flash-lite.
      const modelsToTry = ["gemini-3.5-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];
      let lastError: any = null;
      let responseText = "";
      let successfulModel = "";
      let sources: { title: string; url: string }[] = [];

      for (const modelName of modelsToTry) {
        let attempts = 0;
        const maxAttempts = 2;
        while (attempts < maxAttempts) {
          try {
            console.log(`Attempting generation with model: ${modelName} (attempt ${attempts + 1}, useSearch=${!!useSearch})`);
            const response = await ai.models.generateContent({
              model: modelName,
              contents,
              config,
            });
            responseText = response.text || "No response received.";
            successfulModel = modelName;

            // Extract Google Search Grounding sources if returned
            const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
            if (groundingMetadata && groundingMetadata.groundingChunks) {
              const chunks = groundingMetadata.groundingChunks;
              const mappedSources = chunks
                .filter((chunk: any) => chunk.web)
                .map((chunk: any) => ({
                  title: chunk.web.title || chunk.web.uri || "Search Source",
                  url: chunk.web.uri,
                }));
              // Deduplicate sources by URL
              sources = Array.from(new Map(mappedSources.map((s: any) => [s.url, s])).values());
            }

            break; // Success! Break the attempt loop.
          } catch (err: any) {
            attempts++;
            lastError = err;
            console.warn(`Attempt ${attempts} failed for model ${modelName}:`, err.message || err);
            
            // If it's a 4xx client-side error (like invalid API key, bad request) - EXCEPT 429 rate limit or 408 timeout, don't retry or try fallback models
            if (err.status && err.status >= 400 && err.status < 500 && err.status !== 429 && err.status !== 408) {
              throw err;
            }

            if (attempts < maxAttempts) {
              // Incremental backoff delay
              await new Promise((resolve) => setTimeout(resolve, 800 * attempts));
            }
          }
        }
        if (responseText) {
          break; // Success! Break the model selection loop.
        }
      }

      if (!responseText && lastError) {
        throw lastError;
      }

      console.log(`Successfully completed generation using model: ${successfulModel}`);
      res.json({
        response: responseText,
        modelUsed: successfulModel,
        sources: sources.length > 0 ? sources : undefined,
      });
    } catch (error: any) {
      console.error("Error in /api/chat:", error);
      
      let clientErrorMessage = error.message || "An error occurred while generating response.";
      const status = error.status || 500;
      
      // Customize specific errors to be highly developer and user friendly
      if (status === 429 || clientErrorMessage.includes("quota") || clientErrorMessage.includes("RESOURCE_EXHAUSTED")) {
        clientErrorMessage = "You have temporarily exceeded the Gemini API request quota limits. The free tier limits requests to 15 per minute. Please pause for 1 minute before trying again, or configure a paid plan API key in Settings > Secrets to unlock full high-throughput access.";
      } else if (status === 401 || clientErrorMessage.includes("API key")) {
        clientErrorMessage = "Invalid GEMINI_API_KEY detected. Please make sure the API key is active and correctly configured under your settings secrets.";
      } else if (status === 503 || clientErrorMessage.includes("UNAVAILABLE")) {
        clientErrorMessage = "The Gemini models are currently experiencing extremely high demand. Please try sending your message again in a few seconds.";
      }
      
      res.status(status).json({ error: clientErrorMessage });
    }
  });

  // Vite development middleware vs Static Production bundle serving
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
