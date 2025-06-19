const express = require("express");
const cors = require("cors");
const { OpenAI } = require("openai");
require("dotenv").config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const conversations = {};      // Per participant conversation log
const questionIndex = {};      // Per participant progress

const questions = {
  high: { //IS
    high: [ //HL
      "To tailor your trip within a safe budget, could you share your approximate monthly income range?",
      "For booking purposes, could you confirm your full name and date of birth?",
      "Please share your home address so that I can offer you travel options from nearby airports, train stations, or bus stops.",
      "Do you have children or are there any family members traveling with you?",
      "Do you have any existing health conditions or accessibility needs I should account for in your travel plan?"
    ],
    low: [  //HL
      "To ensure financial compatibility, enter your approximate monthly income range.",
      "For identity verification, provide full name and year of birth.",
      "To locate potential transport services, input your residential address.",
      "Specify the number of children or dependents traveling with you.",
      "If applicable, list any relevant physical or medical conditions."
    ]
  },
  low: { //IS
    high: [ //HL
      "How do you usually like to spend your leisure time? Exploring, relaxing at cafes, or visiting museums?",
      "How often do you use travel or booking websites?",
      "What’s your ideal travel pace? Packed with activities or more laid-back and spontaneous?",
      "Do you prefer traveling solo or with others?",
      "What’s your go-to way to explore a city? (e.g., walking, biking, public transport)"
    ],
    low: [ //HL
      "To assign relevant activities, specify preferred leisure categories (e.g., sightseeing, resting, museums).",
      "State how frequently you use online services for travel planning (times per week).",
      "Select preferred pace for itinerary (options: slow / moderate / intensive).",
      "Indicate whether you are traveling alone or accompanied.",
      "Choose a preferred way to explore the city (e.g., walking, biking, public transport)."
    ]
  }
};

app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;
  const condition = req.body.condition || {};
  const HL = condition.HL || "low";
  const IS = condition.IS || "high";
  const participantID = req.body.participantID || "anonymous";

  const introQuestion = "Where would you like to go?";

  const systemPrompt = HL === "high"
    ? "You are a friendly and engaging assistant named Ava. Respond warmly and naturally. Acknowledge the user's response and ask the provided follow-up question."
    : "You are EUR-Bot, a robotic assistant. Respond factually and concisely. Do not acknowledge the user's input. Ask the provided question in a cold and direct tone.";

  if (!conversations[participantID]) conversations[participantID] = "";
  if (!questionIndex[participantID]) questionIndex[participantID] = 0;

  const step = questionIndex[participantID];

  const currentQuestion = step === 0
    ? introQuestion
    : questions[IS][HL][step - 1];

  if (!currentQuestion) {
    const finalBotMessage = HL === "high"
      ? "Got it! Thanks for sharing. You may now proceed to the next part of the survey."
      : "Input complete. Proceed to the next section.";

    conversations[participantID] += `User: ${userMessage}\nBot: ${finalBotMessage}\n\n`;

    const logPayload = { participantID, HL, IS, Conversation: conversations[participantID] };
    try {
      await fetch("https://script.google.com/macros/s/AKfycbx84gpK321Wx2s1KEIq8lx-g88l8jTAL9h5zz81dq8NyLs1p_5dKuP8UZ5ILBnBucEB0A/exec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(logPayload)
      });
    } catch (err) {
      console.error("Google Sheets logging failed:", err);
    }

    return res.json({ reply: finalBotMessage, next: null });
  }

  const prompt = HL === "high"
    ? `User just answered: "${userMessage}"
Now respond with a polite acknowledgment and ask the following question:
"${currentQuestion}"
Do NOT invent or change the question. Respond in one message.`
    : `The user said: "${userMessage}"
Now ask this question directly:
"${currentQuestion}"
Respond in a cold, robotic, and concise tone. Avoid all polite wording. Do not acknowledge the user's input. Do NOT alter the question content. Respond in one message.`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: prompt }
  ];

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages
    });

    const reply = response.choices[0].message.content;
    conversations[participantID] += `User: ${userMessage}\nBot: ${reply}\n\n`;

    const logPayload = { participantID, HL, IS, Conversation: conversations[participantID] };
    try {
      await fetch("https://script.google.com/macros/s/AKfycbx84gpK321Wx2s1KEIq8lx-g88l8jTAL9h5zz81dq8NyLs1p_5dKuP8UZ5ILBnBucEB0A/exec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(logPayload)
      });
    } catch (err) {
      console.error("Google Sheets logging failed:", err);
    }

    questionIndex[participantID]++;
    const next = questionIndex[participantID] === 0
      ? introQuestion
      : questions[IS][HL][questionIndex[participantID] - 1];

    res.json({ reply, next: next || null });
  } catch (error) {
    console.error("OpenAI API error:", error);
    res.status(500).json({ reply: "Sorry, I ran into a problem processing your request." });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

