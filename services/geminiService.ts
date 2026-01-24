
import { GoogleGenAI } from "@google/genai";

export const generateDescription = async (productName: string): Promise<string> => {
  if (!productName.trim()) {
    throw new Error("Product name cannot be empty.");
  }
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const prompt = `Genera una descripción de producto corta y atractiva para un sistema de punto de venta. El producto es: "${productName}". La descripción debe ser de una sola oración, máximo 20 palabras.`;
    
    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
    });
    
    const text = response.text;

    if (!text) {
      throw new Error("Received an empty response from the API.");
    }
    
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
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const prompt = `
      **PERSONA:** Actúa como un Senior Business Consultant especializado en Retail de Moda y Estrategia de Operaciones con 20 años de experiencia en el sector (estilo Inditex, LVMH o Nike).
      
      **CONTEXTO:** Estás analizando los datos de "Street/Bombón", una boutique multisede. Tu objetivo es maximizar la rentabilidad analizando:
      1. **Optimización de Inventario:** Usa conceptos de modelo OTB (Open-to-Buy), análisis ABC (A-Top ventas, B-Media rotación, C-Lenta rotación) y control de stock muerto (deadstock).
      2. **Estrategia de Ventas:** Sugiere tácticas de up-selling, cross-selling y fidelización basadas en el ciclo de vida del producto.
      3. **Administración Financiera:** Evalúa KPIs como Sell-through rate y margen de contribución.

      **DATOS ACTUALES DEL NEGOCIO (JSON):**
      ${JSON.stringify(salesData, null, 2)}

      **CONSULTA DEL CLIENTE:**
      "${userQuery}"

      **INSTRUCCIONES CRÍTICAS DE RESPUESTA:**
      1. **Contextualización:** Si el query es vago o te faltan datos clave para ser preciso, haz una pregunta específica al inicio para profundizar.
      2. **Impacto de Negocio:** Siempre que sugieras una acción, explica su impacto esperado en el **flujo de caja (Cash Flow)** o en el **posicionamiento de marca**.
      3. **Formato:** Usa Markdown impecable. Títulos ##, subtítulos ###, negritas ** para cifras y conceptos clave.
      4. **Modernidad:** Integra conceptos de omnicanalidad y social commerce si son relevantes.
      5. **Tono:** Profesional, analítico, directo y altamente estratégico.

      Responde en español, enfocándote en rentabilidad neta.
    `;
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
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

export const getAccountingChatResponse = async (
  accountingData: any, 
  history: { role: 'user' | 'model', parts: { text: string }[] }[], 
  userMessage: string
): Promise<string> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    try {
        const systemInstruction = `
            Eres el Contador Jefe de "Street/Bombón". Tu misión es ayudar al dueño a entender sus finanzas y tomar decisiones estratégicas.
            
            **DATOS FINANCIEROS DEL MES:**
            ${JSON.stringify(accountingData, null, 2)}
            
            **TU FORMA DE TRABAJAR:**
            1. Saludo profesional y directo.
            2. Siempre basa tus respuestas en los datos proporcionados arriba.
            3. Si te preguntan sobre utilidad, ingresos o gastos, usa las cifras exactas.
            4. Si el usuario te hace preguntas de seguimiento, mantén el hilo de la conversación.
            5. Usa Markdown (negritas, listas, subtítulos) para que la información sea fácil de leer.
            6. Si notas algo preocupante (ej. gastos muy altos vs ingresos), menciónalo con tacto pero con firmeza profesional.
            
            Responde siempre en español.
        `;

        const chat = ai.chats.create({
            model: 'gemini-3-pro-preview',
            config: {
                systemInstruction: systemInstruction,
            },
            history: history,
        });

        const response = await chat.sendMessage({ message: userMessage });
        return response.text || "No se pudo generar una respuesta.";
    } catch (error) {
        console.error("Gemini Accounting Chat Error:", error);
        throw error;
    }
};
