// server.js
import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// ----- Miljövariabler (sätt dessa i Render) -----
const DIDWW_API_KEY = process.env.DIDWW_API_KEY; // API key från DIDWW (Api-Key eller Bearer beroende på ditt konto)
const DIDWW_NUMBER = process.env.DIDWW_NUMBER;   // ditt köpta DIDWW-nummer, E.164, t.ex. "+468XXXXXXX"
const MESSAGE_URL = process.env.MESSAGE_URL;     // publik MP3, t.ex. "https://example.com/message.mp3"
// -------------------------------------------------

if (!DIDWW_API_KEY || !DIDWW_NUMBER || !MESSAGE_URL) {
  console.warn("ENV VARS saknas: DIDWW_API_KEY, DIDWW_NUMBER eller MESSAGE_URL");
}

app.post("/incoming", (req, res) => {
  try {
    console.log("=== Received DIDWW Call Event ===");
    console.log(new Date().toISOString(), req.body);

    // DIDWW kan skicka olika fält beroende på event; vi försöker flera vanliga namn:
    const payload = req.body || {};
    const from =
      payload.from ||
      payload.From ||
      (payload.data && payload.data.attributes && payload.data.attributes.from) ||
      payload.caller;

    const to =
      payload.to ||
      payload.To ||
      (payload.data && payload.data.attributes && payload.data.attributes.to);

    // Bekräfta omedelbart för DIDWW (viktigt att svara snabbt på webhook)
    res.sendStatus(200);

    if (!from || !to) {
      console.warn("Missing 'from' or 'to' in payload — skipping callback");
      return;
    }

    // Logga ut för spårning
    console.log(`Incoming call from ${from} to ${to}. Scheduling callback in 60s.`);

    // För demo: enkel setTimeout. I produktion: använd job-queue (Bull/RQ) så jobben överlever processstarter.
    setTimeout(async () => {
      try {
        console.log(`Creating outbound call from ${to} -> ${from}`);

        // Exempel-body; DIDWW har JSON:API-stil i V3 för många objekt.
        // Obs: kontrollera DIDWW docs för exakt schema för /calls i din API-version.
        const body = {
          data: {
            type: "calls",
            attributes: {
              from: to,
              to: from,
              // voice handling - många DIDWW implementeringar använder en "play" eller "answer_url"
              // Om DIDWW kräver annan struktur, anpassa efter response i console.log nedan.
              voice: {
                play: MESSAGE_URL
              }
            }
          }
        };

        // Anropa DIDWW API (produktion: https://api.didww.com/v3/)
        const resp = await fetch("https://api.didww.com/v3/calls", {
          method: "POST",
          headers: {
            "Content-Type": "application/vnd.api+json",
            // DIDWW examples använder ofta Api-Key header; vissa konton använder Bearer token.
            // Om Api-Key inte fungerar: byt till "Authorization: Bearer <token>"
            "Api-Key": DIDWW_API_KEY
          },
          body: JSON.stringify(body)
        });

        const resultText = await resp.text();
        let result;
        try { result = JSON.parse(resultText); } catch (e) { result = resultText; }
        console.log("DIDWW /calls response (status " + resp.status + "):", result);
      } catch (err) {
        console.error("Error calling DIDWW /calls:", err);
      }
    }, 60000);
  } catch (e) {
    console.error("Unhandled error in /incoming:", e);
    // Ge DIDWW ett 200 ändå? Här väljer vi 500 om vi kraschar så de vet.
    try { res.sendStatus(500); } catch {}
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on port ${port}`));
