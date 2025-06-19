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
  high: {
    high: [
      "Could I ask for your age or birth year to help tailor recommendations?",
      "Are you traveling with any children or family members?",
      "What’s your current city or home location?",
      "Would you feel comfortable sharing a ballpark of your yearly travel budget?",
      "How many people are employed in your household?"
    ],
    low: [
      "How old are you?",
      "Are you traveling with kids or others?",
      "Your current city?",
      "Travel budget estimate?",
      "Employed people in household?"
    ]
  },
  low: {
    high: [
      "How often do you shop online for travel gear or bookings?",
      "What types of websites do you usually visit when planning trips?",
      "How much leisure time do you usually plan for yourself during city trips?",
      "Do you follow any travel blogs or read travel-related news online?",
      "What’s your go-to way to explore a city — walking, biking, public transport?"
    ],
    low: [
      "How often do you shop online for travel gear or bookings?",
      "What websites do you use to plan travel?",
      "How much free time do you plan on city trips?",
      "Do you read travel blogs or news sites?",
      "How do you explore cities: walk, bike, or transport?"
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

