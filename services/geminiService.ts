import { GoogleGenAI } from "@google/genai";

// Helper to initialize GoogleGenAI with appropriate headers and key
const getAiClient = (): GoogleGenAI => {
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  return new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
};

export const generateDescription = async (productName: string): Promise<string> => {
  if (!productName.trim()) {
    throw new Error("Product name cannot be empty.");
  }
  
  const ai = getAiClient();
  
  try {
    const prompt = `Genera una descripción de producto corta y atractiva para un sistema de punto de venta. El producto es: "${productName}". La descripción debe ser de una sola oración, máximo 20 palabras.`;
    
    const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
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
  
  const ai = getAiClient();
  
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
 
      Responde en español, enfocándose en rentabilidad neta.
    `;
    
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
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

export const generateStrategicReport = async (data: any): Promise<string> => {
  if (!data) {
    throw new Error("Data for report cannot be empty.");
  }
  
  const ai = getAiClient();
  
  try {
    const prompt = `
      **PERSONA:** Actúa como un Senior Business Consultant y Estratega de Retail de Lujo y Moda. Tu especialidad es transformar datos crudos en estrategias accionables que aumenten el margen neto y la fidelización.
 
      **OBJETIVO:** Generar un "Reporte Estratégico de Alto Impacto" basado en los datos proporcionados.
 
      **DATOS DEL NEGOCIO:**
      ${JSON.stringify(data, null, 2)}
 
      **ESTRUCTURA DEL REPORTE (MANDATORIA):**
      1. **Resumen Ejecutivo (Executive Summary):** Una visión de 30,000 pies sobre la salud del negocio en este periodo.
      2. **Análisis de Ventas y Rentabilidad:** Identifica qué está moviendo la aguja y qué está drenando recursos.
      3. **Diagnóstico de Inventario:** Análisis de rotación. ¿Qué debemos liquidar? ¿Qué debemos reponer con urgencia?
      4. **Comportamiento del Cliente:** Análisis de retención y riesgo de fuga.
      5. **Plan de Acción (Actionable Strategies):** 3-5 estrategias concretas, numeradas, con pasos específicos a seguir mañana mismo.
      6. **Proyección y Recomendación:** ¿Hacia dónde vamos si seguimos así?
 
      **INSTRUCCIONES DE ESTILO:**
      - Usa Markdown editorial de alta calidad.
      - Títulos elegantes (##), subtítulos (###).
      - Usa **negritas** para cifras clave y conceptos estratégicos.
      - El tono debe ser inspirador pero basado en datos duros.
      - Sé conciso pero profundo. Evita generalidades.
 
      Responde en español.
    `;
    
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt,
    });
    
    const text = response.text;

    if (!text) {
      throw new Error("Received an empty response from the Strategic Report API.");
    }
    
    return text.trim();
    
  } catch (error) {
    console.error("Error calling Gemini API for strategic report:", error);
    throw new Error("Failed to generate strategic report from Gemini API.");
  }
};

export const getAccountingChatResponse = async (
  accountingData: any, 
  history: { role: 'user' | 'model', parts: { text: string }[] }[], 
  userMessage: string
): Promise<string> => {
    const ai = getAiClient();
    
    try {
        const systemInstruction = `
            Eres el Director Financiero (CFO) y Contador Jefe de "Street/Bombón". Tu misión es transformar datos operativos en reportes contables estratégicos.
            
            **DATOS FINANCIEROS Y OPERATIVOS:**
            ${JSON.stringify(accountingData, null, 2)}
            
            **CAPACIDADES DE REPORTE:**
            1. **Estado de Resultados (PyG):** Ingresos totales, Costo de Ventas (COGS), Utilidad Bruta, Gastos Operativos (Nómina + Gastos), Utilidad Neta y Margen.
            2. **Balance General (Simplificado):** Activos (Caja estimada + Valor de Inventario en costo) vs **Pasivos (Créditos y préstamos bancarios/personales activos)**, Patrimonio Neto (Activos - Pasivos).
            3. **Flujo de Caja (Cash Flow):** Entradas (Recaudos por ventas y abonos) vs Salidas (Pagos de compras del mes, gastos, nómina y obligaciones de cuotas de préstamos).
            
            **TU FORMA DE TRABAJAR:**
            1. Saludo corporativo.
            2. Si piden un reporte (PyG, Balance, Flujo), estrécturalo con tablas de Markdown o listas claras, detallando la deuda activa actual (préstamos acumulados) si es consultado sobre el balance o salud financiera general.
            3. Analiza el "Nivel de Endeudamiento y Apalancamiento": Advierte si los créditos activos representan un riesgo frente a la utilidad neta o si las cuotas de préstamos mensuales ahogan el flujo de caja operativo corriente.
            4. Analiza la "Salud del Inventario": Compara el valor del inventario contra las ventas mensuales para detectar exceso de stock.
            5. Identifica "Fugas de Capital": Si los gastos o compras superan por mucho a los ingresos.
            5. Mantén el contexto de la conversación.
            
            Usa Markdown (## para títulos, ### para secciones, ** para valores monetarios).
            Responde siempre en español.
        `;

        const chat = ai.chats.create({
            model: 'gemini-3.5-flash',
            config: {
                systemInstruction: systemInstruction,
            },
            history: history,
        });

        const response = await chat.sendMessage({ message: userMessage });
        return response.text || "No se pudo generar una respuesta contable.";
    } catch (error) {
        console.error("Gemini Accounting Chat Error:", error);
        throw error;
    }
};

export const getCeoCenterChatResponse = async (
  ceoData: any, 
  history: { role: 'user' | 'model', parts: { text: string }[] }[], 
  userMessage: string
): Promise<string> => {
    const ai = getAiClient();
    
    try {
        const systemInstruction = `
            Eres "Consultor IA", el Asistente Ejecutivo de Estrategia y Operaciones de "Street/Bombón" (tiendas Bombón Divino, Bombón Metro y Street Legends).
            
            **DATOS INTEGRALES DEL NEGOCIO (MULTISEDE):**
            ${JSON.stringify(ceoData, null, 2)}
            
            **TU FILOSOFÍA Y FUNCIÓN:**
            1. Eres el consultor número uno del CEO. No andas con rodeos ni dashboards vacíos. Das sugerencias claras para tomar DECISIONES.
            2. Analizas la energía del día registrada por las vendedoras, las preguntas frecuentes de clientes, los productos estrella, los lentos, las alertas y las decisiones que ya se han tomado.
            3. Si el usuario te pregunta algo, responde basándote en los datos reales de ventas, inventarios, cobros y notas.
            4. Tu tono es profesional, agudo, con mentalidad de crecimiento, directo y altamente estratégico.
            
            Usa Markdown (## para títulos, ### para secciones, ** para valores monetarios).
            Responde siempre en español.
        `;

        const chat = ai.chats.create({
            model: 'gemini-3.5-flash',
            config: {
                systemInstruction: systemInstruction,
            },
            history: history,
        });

        const response = await chat.sendMessage({ message: userMessage });
        return response.text || "No se pudo generar una respuesta.";
    } catch (error) {
        console.error("Gemini CEO Chat Error:", error);
        throw error;
    }
};

export const generateProactiveCeoInsights = async (ceoData: any): Promise<string> => {
    const ai = getAiClient();
    
    try {
        const prompt = `
            Actúa como "Consultor IA", el Asistente Ejecutivo de Estrategia y Operaciones de "Street/Bombón".
            Analiza los siguientes datos actuales de las tres sedes del negocio:
            ${JSON.stringify(ceoData, null, 2)}
            
            Genera un mensaje proactivo diario de alto impacto (sin que el CEO te lo pida). Debe contener:
            1. **Un saludo motivador y directo.**
            2. **Un insight de oro sobre los datos de hoy/esta semana** (ej. "Metro tiene un pico de energía🟢 pero baja conversión", o "Se registraron 3 preguntas sobre blusas negras en Divino").
            3. **Una recomendación táctica concreta para hoy** (ej. "Lanza una promoción cruzada", "Mueve stock de X de Divino a Metro").
            
            La respuesta debe ser concisa, sumamente valiosa, directo y estructurada en Markdown (máximo 120 palabras).
            Responde en español.
        `;
        
        const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: prompt,
        });
        
        return response.text || "No hay insights disponibles para hoy.";
    } catch (error) {
        console.error("Gemini proactive insights error:", error);
        return "No se pudieron calcular insights proactivos en este momento.";
    }
};

