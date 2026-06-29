import { Project } from '../types';

/**
 * Generates a concise investment analysis for a project via backend API route.
 */
export const getInvestmentAnalysis = async (project: Project): Promise<string> => {
  try {
    const response = await fetch("/api/gemini/investment-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project }),
    });
    if (!response.ok) {
      throw new Error("API request failed");
    }
    const data = await response.json();
    return data.text || "No analysis generated.";
  } catch (error) {
    console.error("Error fetching analysis from server:", error);
    return "We are currently unable to generate a detailed analysis. Please try again later.";
  }
};

/**
 * Generates a marketing description for a project via backend API route.
 */
export const generateProjectDescription = async (project: Project): Promise<string> => {
  try {
    const response = await fetch("/api/gemini/project-description", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ project }),
    });
    if (!response.ok) {
      return project.description;
    }
    const data = await response.json();
    return data.text ? data.text.trim() : project.description;
  } catch (error) {
    console.error("Error generating description from server:", error);
    return project.description;
  }
};

/**
 * Provides loan affordability advice via backend API route.
 */
export const getLoanAffordabilityAdvice = async (loanAmount: string, emi: number, monthlyIncome: string): Promise<string> => {
  try {
    const response = await fetch("/api/gemini/loan-advice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loanAmount, emi, monthlyIncome }),
    });
    if (!response.ok) {
      throw new Error("API request failed");
    }
    const data = await response.json();
    return data.text || "Could not generate advice.";
  } catch (error) {
    console.error("Error getting affordability advice from server:", error);
    return "We are currently unable to generate financial advice. Please try again later.";
  }
};
