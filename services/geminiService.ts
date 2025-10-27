
import { GoogleGenAI } from "@google/genai";

// Ensure API_KEY is available in the environment variables
const apiKey = process.env.API_KEY;
if (!apiKey) {
    throw new Error("API_KEY environment variable not set.");
}
const ai = new GoogleGenAI({ apiKey });

export const generateDescription = async (productName: string): Promise<string> => {
  if (!productName.trim()) {
    throw new Error("Product name cannot be empty.");
  }
  
  try {
    const prompt = `Genera una descripción de producto corta y atractiva para un sistema de punto de venta. El producto es: "${productName}". La descripción debe ser de una sola oración, máximo 20 palabras.`;
    
    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
    });
    
    const text = response.text;

    if (!text) {
      throw new Error("Received an empty response from the API.");
    }
    
    // Clean up the response, removing potential markdown or quotes
    return text.trim().replace(/^"|"$/g, '');
    
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw new Error("Failed to generate description from Gemini API.");
  }
};

export const analyzeSalesData = async (salesData: any, userQuery: string): Promise<string> => {
  if (!salesData || !userQuery) {
    throw new Error("Sales data and user query cannot be empty.");
  }
  
  try {
    const model = 'gemini-2.5-pro'; // Use a more powerful model for analysis
    
    const prompt = `
      Eres un experto analista de ventas para una cadena de boutiques de moda llamada "Street/Bombón".
      Te proporcionaré datos de ventas y de inventario en formato JSON para un período específico. Tu tarea es analizar estos datos y proporcionar insights claros y accionables en español, en formato Markdown.

      **Contexto:**
      - La empresa tiene varias tiendas.
      - Queremos entender qué productos funcionan bien, cuáles no, y cómo se comparan las tiendas.
      - Tus respuestas deben ser fáciles de leer para un gerente de tienda, no para un analista de datos. Usa títulos, listas con viñetas y texto en negrita para resaltar los puntos clave. Sé directo y enfócate en lo más importante.

      **Datos para Analizar:**
      ${JSON.stringify(salesData, null, 2)}

      **Solicitud de Análisis Específica:**
      "${userQuery}"

      **Instrucciones de Formato de Respuesta:**
      - Usa títulos en Markdown (ej: ## Título Principal).
      - Usa subtítulos (ej: ### Subtítulo).
      - Usa listas con viñetas (*).
      - Usa negrita (**) para resaltar nombres de productos, tiendas, cifras importantes o conclusiones clave.
      - La respuesta debe ser concisa, profesional y directamente accionable.
    `;
    
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });
    
    const text = response.text;

    if (!text) {
      throw new Error("Received an empty response from the AI analysis API.");
    }
    
    return text.trim();
    
  } catch (error) {
    console.error("Error calling Gemini API for sales analysis:", error);
    throw new Error("Failed to generate sales analysis from Gemini API.");
  }
};
