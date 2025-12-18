
import { GoogleGenAI } from "@google/genai";
import { ConnectionMode, SecurityReport } from '../types';

/**
 * Analyzes security and anonymity level using the Gemini API.
 */
export const analyzeSecurity = async (
  mode: ConnectionMode,
  location: string,
  ip: string
): Promise<SecurityReport> => {
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    return {
      score: 85,
      threatLevel: 'Faible',
      recommendations: [
        "Clé API manquante: Impossible de contacter Gemini.",
        "Le mode simulation est actif."
      ],
      analysis: "Le système fonctionne en mode hors ligne. Configurez une clé API."
    };
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    Agis comme un expert en cybersécurité pour l'application "Renumerate VPN".
    L'utilisateur est connecté via un serveur en ${location} (IP simulée: ${ip}).
    Le mode de connexion est : ${mode}.
    
    Analyse brièvement (max 60 mots) le niveau de sécurité et d'anonymat.
    Donne un score de sécurité sur 100.
    Donne 3 recommandations très courtes et techniques.
    
    Réponds UNIQUEMENT au format JSON :
    {
      "score": number,
      "threatLevel": "Faible" | "Moyen" | "Élevé" | "Critique",
      "analysis": "string",
      "recommendations": ["string", "string", "string"]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    return JSON.parse(text.trim()) as SecurityReport;
  } catch (error) {
    console.error("Gemini Error:", error);
    return {
      score: 0,
      threatLevel: 'Critique' as any,
      recommendations: ["Erreur de connexion AI", "Vérifiez vos paramètres"],
      analysis: "Impossible de générer le rapport de sécurité."
    };
  }
};

/**
 * Performs a deep privacy audit using Google Search grounding.
 */
export const performDeepAudit = async (ip: string, location: string): Promise<{
  analysis: string;
  sources: { title: string; uri: string }[];
  isBlacklisted: boolean;
}> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key required for deep audit");

  const ai = new GoogleGenAI({ apiKey });
  
  const prompt = `Perform a security audit for a VPN exit node located in ${location} with simulated IP ${ip}. 
  Check if this IP range or location is currently associated with known blacklists, botnets, or high-risk ISP activities.
  Provide a technical summary in French. Use Google Search to find real-time data about VPN server reputation in this region.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }]
      }
    });

    const analysis = response.text || "Audit terminé. Aucun risque majeur détecté.";
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    
    const sources = chunks
      .filter((chunk: any) => chunk.web)
      .map((chunk: any) => ({
        title: chunk.web.title || 'Source Audit',
        uri: chunk.web.uri
      }));

    return {
      analysis,
      sources,
      isBlacklisted: analysis.toLowerCase().includes('blacklist') || analysis.toLowerCase().includes('risque élevé')
    };
  } catch (error) {
    console.error("Audit Error:", error);
    return {
      analysis: "Erreur lors de l'audit profond. Veuillez réessayer.",
      sources: [],
      isBlacklisted: false
    };
  }
};
