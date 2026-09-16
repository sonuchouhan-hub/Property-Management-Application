import express from "express";
import path from "path";
import http from "http";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import nodemailer from "nodemailer";

// Lazy init of transporter
let mailTransporter: any = null;

const getMailTransporter = () => {
  if (mailTransporter) return mailTransporter;
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn("SMTP credentials not fully configured. Email notifications will fall back to server logs.");
    return null;
  }

  mailTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
  return mailTransporter;
};

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

function decodeFirebaseToken(token: string) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = parts[1];
    const decoded = Buffer.from(payload, 'base64').toString('utf8');
    return JSON.parse(decoded);
  } catch (err) {
    return null;
  }
}

async function generateContentWithRetry(ai: any, params: any, retries = 3, delayMs = 1000): Promise<any> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (error: any) {
      const is503 = error?.status === 503 || 
                    error?.statusCode === 503 || 
                    error?.status === "UNAVAILABLE" ||
                    (error?.message && (error.message.includes("503") || error.message.includes("UNAVAILABLE"))) ||
                    (error?.error && (JSON.stringify(error.error).includes("503") || JSON.stringify(error.error).includes("UNAVAILABLE"))) ||
                    (error && JSON.stringify(error).includes("503")) ||
                    (error && JSON.stringify(error).includes("UNAVAILABLE"));
                    
      if (is503 && attempt < retries) {
        console.warn(`Gemini API returned 503 (high demand). Retrying attempt ${attempt}/${retries} after ${delayMs}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        delayMs *= 2; // exponential backoff
        continue;
      }
      throw error;
    }
  }
}

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = 3000;

  app.use(express.json());

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  const adminAuthMiddleware = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: Missing authentication token" });
    }

    const token = authHeader.split(" ")[1];
    const payload = decodeFirebaseToken(token);

    if (!payload) {
      return res.status(403).json({ error: "Forbidden: Invalid authentication token" });
    }

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return res.status(403).json({ error: "Forbidden: Authentication token has expired" });
    }

    const SUPER_ADMIN_EMAILS = [
      "aiconsultdhanshri@gmail.com",
      "pnkalra20@gmail.com",
      "sc.dhanshri@gmail.com",
      "sonuchouhan1528@gmail.com",
      "sonuchouhan@gmail.com"
    ];
    const userEmail = payload.email?.toLowerCase().trim();
    const isSpecificAdmin = userEmail ? SUPER_ADMIN_EMAILS.includes(userEmail) : false;

    if (!isSpecificAdmin) {
      return res.status(403).json({ error: "Forbidden: Access restricted to authorized administrator only" });
    }

    next();
  };

  app.get("/api/admin/verify", adminAuthMiddleware, (req, res) => {
    res.json({ status: "authorized", admin: true });
  });

  app.post("/api/auth/register-notify", async (req, res) => {
    const { fullName, email, mobile, role, createdAt } = req.body;
    const userAgent = req.headers['user-agent'] || 'Unknown Device';
    const ip = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';

    console.log(`[AUTH NOTIFICATION] New user registered:
      Name: ${fullName}
      Email: ${email}
      Mobile: ${mobile}
      Role: ${role}
      Date: ${createdAt}
      IP: ${ip}
      Device: ${userAgent}
    `);

    const mailOptions = {
      from: process.env.SMTP_FROM || '"Dhanshri Admin" <noreply@dhanshriproperties.com>',
      to: 'sonuchouha1528@gmail.com',
      subject: `🚨 Action Required: New User Registration Approval Request`,
      text: `
Hello Admin,

A new user has registered on Dhanshri Properties Management App and is currently pending approval.

User Details:
- Full Name: ${fullName}
- Email Address: ${email}
- Phone Number: ${mobile}
- Requested Role: ${role}
- Registration Date & Time: ${createdAt}

System Metadata:
- Device Information: ${userAgent}
- IP Address: ${ip}

Please log in to the Admin Dashboard to approve or reject this request.

Best regards,
Dhanshri Properties System
      `,
      html: `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 12px; background-color: #ffffff;">
    <div style="text-align: center; border-bottom: 2px solid #2563eb; padding-bottom: 15px; margin-bottom: 20px;">
      <h2 style="color: #1e40af; margin: 0; font-size: 24px;">Dhanshri Properties</h2>
      <p style="color: #6b7280; margin: 5px 0 0; font-size: 14px;">User Registration Notification System</p>
    </div>
    
    <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 15px; border-radius: 0 8px 8px 0; margin-bottom: 20px;">
      <h3 style="margin: 0; color: #1e3a8a; font-size: 16px;">Approval Request Pending Approval</h3>
      <p style="margin: 5px 0 0; color: #1e40af; font-size: 13px;">A new account registration requires administrator authorization before accessing the app.</p>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <tbody>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; color: #6b7280; font-weight: bold; width: 35%;">Full Name</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; color: #111827; font-weight: bold;">${fullName}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; color: #6b7280; font-weight: bold;">Email Address</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; color: #2563eb; font-weight: bold;"><a href="mailto:${email}" style="color: #2563eb; text-decoration: none;">${email}</a></td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; color: #6b7280; font-weight: bold;">Phone Number</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; color: #111827;">${mobile || 'Not provided'}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; color: #6b7280; font-weight: bold;">Requested Role</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; color: #111827;"><span style="background-color: #f3f4f6; padding: 3px 8px; border-radius: 4px; font-size: 12px; font-weight: bold;">${role.toUpperCase()}</span></td>
        </tr>
        <tr>
          <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; color: #6b7280; font-weight: bold;">Registration Date</td>
          <td style="padding: 10px 0; border-bottom: 1px solid #f3f4f6; color: #111827;">${new Date(createdAt).toLocaleString('en-IN')}</td>
        </tr>
      </tbody>
    </table>

    <div style="background-color: #f9fafb; border: 1px solid #f3f4f6; padding: 15px; border-radius: 8px; font-size: 11px; color: #9ca3af; font-family: monospace; line-height: 1.4; margin-bottom: 25px;">
      <strong>METADATA:</strong><br/>
      Device: ${userAgent}<br/>
      IP Address: ${ip}
    </div>

    <div style="text-align: center;">
      <p style="font-size: 12px; color: #9ca3af; margin-top: 20px;">This is an automated system-generated notification. Please do not reply directly to this email.</p>
    </div>
  </div>
      `
    };

    const transporter = getMailTransporter();
    if (transporter) {
      try {
        await transporter.sendMail(mailOptions);
        console.log(`[SUCCESS] Registration notification email sent to sonuchouha1528@gmail.com`);
        res.json({ success: true, message: "Approval notification email sent successfully!" });
      } catch (mailError: any) {
        console.error("[ERROR] Failed to send email via SMTP, logged registration metadata.", mailError);
        res.json({ success: true, message: "Logged request metadata successfully (SMTP dispatch failed)." });
      }
    } else {
      res.json({ success: true, message: "Logged request metadata successfully (SMTP is unconfigured)." });
    }
  });

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
      const response = await generateContentWithRetry(ai, {
        model: 'gemini-3.5-flash',
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
      const response = await generateContentWithRetry(ai, {
        model: 'gemini-3.5-flash',
        contents: prompt,
      });
      res.json({ text: response.text });
    } catch (error) {
      console.error("Error getting affordability advice from Gemini, utilizing local fallback:", error);
      res.json({ text: getFallbackLoanAdvice(loanAmount, emi, monthlyIncome) });
    }
  });

  app.post("/api/gemini/copilot", async (req, res) => {
    const { prompt, context } = req.body;
    const ai = getGeminiClient();
    if (!ai) {
      console.warn("Gemini API key not configured. Utilizing local fallback response.");
      return res.json({ text: "The AI Sales Copilot is currently offline or the Gemini API key is missing. Please ask our executives directly." });
    }

    const systemInstruction = `You are Dhanshri Properties AI Sales Copilot, a helpful enterprise real estate CRM assistant.
You have real-time access to the company's real estate database, including:
- Projects (such as Shanti Vihar, Maa Ginni Park, Shrinath Dream City, Redwood Platinum Extension, Meera Govind Park, Meera Valley)
- Bookings and active payment ledgers
- Leads and the 11-stage sales funnel
- Site visits, follow-up meetings, and customer interaction logs

Use the provided database context below to factually answer the user's questions. 
If the user asks for summaries, lead counts, conversion performance, project details, or best performing executive, analyze the context and provide a highly scannable, clean, professional bulleted report.
Do not invent or assume data that is not in the context. Keep your response concise, helpful, and professional. Do not refer to yourself as an AI.

DATABASE CONTEXT:
${JSON.stringify(context || {})}
`;

    try {
      const response = await generateContentWithRetry(ai, {
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.2
        }
      });
      res.json({ text: response.text });
    } catch (error: any) {
      console.error("AI Copilot Error:", error);
      res.status(500).json({ error: "Failed to process AI Copilot response. Please retry." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: {
          server: server
        }
      },
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

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
