import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Fallback generators for graceful degradation during API outages or missing keys
  const getFallbackInvestmentAnalysis = (project: any): string => {
    const name = project.name || "This project";
    const location = project.location || "prime location";
    const total = project.totalPlots || 100;
    const available = project.availablePlots || 0;
    const amenitiesList = project?.amenities && project.amenities.length > 0 
      ? project.amenities.slice(0, 3).join(', ') 
      : "modern layout, internal roads, and secure perimeter fencing";

    return `### Investment Summary: ${name}

**Top Strengths:**
* **Strategic Location:** Situated in ${location}, a rapidly developing region with strong land value appreciation potential.
* **Premium Amenities:** Equipped with high-quality features such as ${amenitiesList}, making it highly attractive for immediate residential construction.
* **Favorable Density:** High-quality master planning with a balanced plot layout of ${total} total units, with ${available} currently available for selection.

**Key Risks & Considerations:**
* **Early Infrastructure Phase:** Immediate possession is dependent on standard local authority approvals and completion of internal roadwork.
* **High Selection Velocity:** Corner and east-facing plots are in high demand and selling quickly, limiting premium layout choices.

**Outlook:**
${name} is an exceptionally strong long-term real estate investment in ${location}. With robust infrastructure plans and high local connectivity, it offers excellent potential for both immediate home-builders and passive property investors seeking reliable capital growth.`;
  };

  const getFallbackProjectDescription = (project: any): string => {
    const name = project.name || "Our Premium Property";
    const location = project.location || "prime location";
    const amenitiesList = project?.amenities && project.amenities.length > 0 
      ? `premium amenities such as ${project.amenities.slice(0, 4).join(', ')}` 
      : "state-of-the-art layout planning, secure gated community access, and lush green zones";

    return `Welcome to ${name}, an elite residential community masterfully crafted in the highly sought-after locale of ${location}. This project provides a spectacular canvas to design your dream home, boasting ${amenitiesList}. Experience the perfect blend of natural tranquility and modern connectivity, offering an unparalleled quality of life and a high-yield investment potential for your family's future.`;
  };

  const getFallbackLoanAdvice = (loanAmount: any, emi: any, monthlyIncome: any): string => {
    const amountNum = parseFloat(String(loanAmount).replace(/[^0-9.]/g, '')) || 0;
    const emiNum = Math.round(parseFloat(String(emi)) || 0);
    const incomeNum = parseFloat(String(monthlyIncome).replace(/[^0-9.]/g, '')) || 1;
    const emiToIncomeRatio = Math.round((emiNum / incomeNum) * 100);

    const amountStr = amountNum ? amountNum.toLocaleString('en-IN') : String(loanAmount);
    const emiStr = emiNum.toLocaleString('en-IN');
    const incomeStr = incomeNum.toLocaleString('en-IN');

    let adviceSection = "";
    if (emiToIncomeRatio <= 35) {
      adviceSection = `With a monthly EMI of ₹${emiStr} against an income of ₹${incomeStr}, your EMI-to-income ratio is approximately **${emiToIncomeRatio}%**. This is well within the recommended **40% threshold**, indicating a highly comfortable and low-risk borrowing level. Your current cash flows can comfortably support this loan without compromising your daily lifestyle or retirement savings goals.`;
    } else if (emiToIncomeRatio <= 50) {
      adviceSection = `With a monthly EMI of ₹${emiStr} against an income of ₹${incomeStr}, your EMI-to-income ratio is **${emiToIncomeRatio}%**. This is within the standard healthy benchmark of **40-50% of your take-home pay**. While this loan is fully manageable, we recommend maintaining a lean monthly budget to ensure your other financial obligations are easily met.`;
    } else {
      adviceSection = `With a monthly EMI of ₹${emiStr} against an income of ₹${incomeStr}, your EMI-to-income ratio is **${emiToIncomeRatio}%**. This exceeds the recommended **50% safety margin** and represents a high-stretch scenario. This may put significant strain on your monthly budget, especially in the event of unforeseen interest rate increases or emergency expenses.`;
    }

    const tip1 = emiToIncomeRatio > 50 
      ? `* **Optimize Loan Parameters:** Consider increasing your down payment to lower the principal, or extending the loan tenure to reduce the monthly EMI to under 40% of your income.`
      : `* **Prepayment Strategy:** Aim to make periodic prepayments towards the principal whenever you receive annual bonuses, which will drastically cut down your overall interest burden.`;

    return `### Loan Affordability Analysis

${adviceSection}

### Key Financial Tips:

${tip1}
* **Build an EMI Buffer:** Before finalizing the loan disbursement, set aside an emergency fund equal to at least 6 months of EMIs (₹${Math.round(emiNum * 6).toLocaleString('en-IN')}) in a separate liquid savings account.
* **Keep Interest Rates Competitive:** Opt for a floating-rate home loan linked to repo rates (EBLR) to benefit from favorable market rate cuts, and monitor your credit score above 750 to retain maximum bargaining power.`;
  };

  app.post("/api/gemini/investment-analysis", async (req, res) => {
    const { project } = req.body;
    const ai = getGeminiClient();
    if (!ai) {
      console.warn("Gemini API key not configured. Utilizing local fallback investment analysis.");
      return res.json({ text: getFallbackInvestmentAnalysis(project) });
    }

    const prompt = `
    Analyze the following real estate project for a potential investor and provide a concise investment summary.
    - Use bullet points to highlight the top 2-3 strengths.
    - Use bullet points to mention 1-2 potential risks or considerations.
    - Conclude with a brief, 1-2 sentence outlook on its investment potential.
    The tone should be professional and easy to read. Keep the entire response under 150 words.
    Do not mention that you are an AI.

    Project Details:
    - Name: ${project.name}
    - Location: ${project.location}
    - Description: ${project.description}
    - Total Plots: ${project.totalPlots}
    - Available Plots: ${project.availablePlots}
    - Key Amenities: ${project?.amenities ? project.amenities.join(', ') : ''}
    `;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Error fetching analysis from Gemini, utilizing local fallback:", error);
      res.json({ text: getFallbackInvestmentAnalysis(project) });
    }
  });

  app.post("/api/gemini/project-description", async (req, res) => {
    const { project } = req.body;
    const ai = getGeminiClient();
    if (!ai) {
      console.warn("Gemini API key not configured. Utilizing local fallback project description.");
      return res.json({ text: getFallbackProjectDescription(project) });
    }

    const prompt = `
        Generate a compelling, marketing-oriented project description for a real estate project. The description should be around 3-4 sentences long, highlighting the key features and lifestyle benefits. Use an engaging and aspirational tone.

        Project Details:
        - Name: ${project.name}
        - Location: ${project.location}
        - Key Amenities: ${project?.amenities ? project.amenities.join(', ') : ''}
    `;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      res.json({ text: response.text ? response.text.trim() : getFallbackProjectDescription(project) });
    } catch (error) {
      console.error("Error generating description from Gemini, utilizing local fallback:", error);
      res.json({ text: getFallbackProjectDescription(project) });
    }
  });

  app.post("/api/gemini/loan-advice", async (req, res) => {
    const { loanAmount, emi, monthlyIncome } = req.body;
    const ai = getGeminiClient();
    if (!ai) {
      console.warn("Gemini API key not configured. Utilizing local fallback loan advice.");
      return res.json({ text: getFallbackLoanAdvice(loanAmount, emi, monthlyIncome) });
    }

    const prompt = `
        Analyze the following financial situation for a potential home loan applicant in India.
        - Loan Amount: ₹${loanAmount}
        - Monthly EMI: ₹${Math.round(emi)}
        - Monthly Income: ₹${monthlyIncome}
        
        Provide a brief, friendly, and encouraging analysis of the loan's affordability. Mention the concept of a healthy EMI-to-Income ratio (ideally under 40-50% of take-home pay).
        Give one or two simple financial tips related to this loan.
        Keep the response to 2-3 short paragraphs.
        Do not give definitive financial advice; use phrases like "it appears manageable" or "this might be a stretch".
        Do not mention you are an AI.
    `;

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });
      res.json({ text: response.text });
    } catch (error) {
      console.error("Error getting affordability advice from Gemini, utilizing local fallback:", error);
      res.json({ text: getFallbackLoanAdvice(loanAmount, emi, monthlyIncome) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
