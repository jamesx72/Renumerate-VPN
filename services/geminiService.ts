import { GoogleGenAI } from "@google/genai";
import { ConnectionMode, SecurityReport } from '../types';

let ai: GoogleGenAI | null = null;

if (process.env.API_KEY) {
  ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
}

export const analyzeSecurity = async (
  mode: ConnectionMode,
  location: string,
  ip: string
): Promise<SecurityReport> => {
  // If no API key, return a mock response to prevent crash
  if (!ai) {
    return {
      score: 85,
      threatLevel: 'Faible',
      recommendations: [
        "Clé API manquante: Impossible de contacter Gemini.",
        "Vérifiez votre configuration.",
        "Le mode simulation est actif."
      ],
      analysis: "Le système fonctionne en mode hors ligne. Veuillez configurer une clé API pour une analyse en temps réel."
    };
  }

  const prompt = `
    Agis comme un expert en cybersécurité pour l'application "Renumerate VPN".
    L'utilisateur est connecté via un serveur en ${location} (IP simulée: ${ip}).
    Le mode de connexion est : ${mode}.
    
    Analyse brièvement (max 60 mots) le niveau de sécurité et d'anonymat.
    Donne un score de sécurité sur 100.
    Donne 3 recommandations très courtes et techniques pour améliorer l'anonymat.
    
    Réponds UNIQUEMENT au format JSON suivant :
    {
      "score": number,
      "threatLevel": "Faible" | "Moyen" | "Élevé" | "Critique",
      "analysis": "string",
      "recommendations": ["string", "string", "string"]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI");
    
    return JSON.parse(text) as SecurityReport;
  } catch (error) {
    console.error("Gemini Error:", error);
    return {
      score: 0,
      threatLevel: 'Inconnu' as any,
      recommendations: ["Erreur de connexion AI", "Réessayez plus tard"],
      analysis: "Impossible de générer le rapport de sécurité."
    };
  }
};