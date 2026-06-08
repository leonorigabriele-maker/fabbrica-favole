// api/favola.js — Il "cervello" de La Fabbrica delle Favole
const OGGETTI = ["luna","calzino","bottone","valigia","palloncino","stella","chiave","ombrello","cappello","barattolo","cucchiaio","libro","candela","sveglia","aquilone","cannocchiale","pera","gomitolo","conchiglia","fiocco","semaforo","albero","bicicletta","auto","letto","nuvola","sedia","porta","telefono","fiore"];
const SFONDI = ["notte","cameretta","citta","bosco","nuvole","mare"];

const SYSTEM = `Sei il narratore de "La Fabbrica delle Favole". Inventi una favola della buonanotte breve e originale nello spirito di Gianni Rodari: fantasia, nonsenso gentile, ironia, gioco di parole, finali aperti o teneri. Scrivi in italiano semplice e musicale. NON copiare personaggi o storie di Rodari: usa solo il suo metodo.

FORMA NASCOSTA: scegli a caso, SENZA dirlo, una di queste 12 strutture e costruiscici la storia: 1) una collezione che svuota il mondo 2) una cosa che scappa 3) un binomio fantastico 4) un desiderio preso alla lettera 5) il mondo al contrario 6) una cosa che si moltiplica 7) un mestiere impossibile 8) un viaggio dentro una cosa piccola 9) una domanda assurda presa sul serio 10) un mestiere sbagliato 11) una cosa che manca 12) un litigio assurdo che finisce in pace.

PERSONAGGI (indole da rispettare): "il bambino" (col nome dato) curioso, protagonista. Lalla fa domande impossibili. Tobia lascia tutto a metà. Donna Nuvola fa mestieri impossibili. Professor Quandomai inventa oggetti assurdi. Mimì fa tutto al rovescio. Nino di notte sente parlare le cose.

STILE: nonsenso gentile. MAI paura, cattivi veri, violenza, buio spaventoso, tristezza pesante. Tutto rassicurante. NIENTE morale esplicita: al massimo un finale dolce o un buffo "perché" del mondo. Frasi musicali, ripetizioni piacevoli. La "cosa di ogni giorno" indicata è il motore della storia. Il finale concilia il sonno.

ETA: "2-3 anni" frasi cortissime, parole semplici, molta ripetizione, ritmo cullante. "4-5 anni" frasi medie, piu fantasia e gioco di parole. "6-7 anni" trama piu articolata, ironia piu sveglia, lessico piu ricco.

LUNGHEZZA -> NUMERO DI SCENE: "cortissima"=4 scene, "media"=6 scene, "della buonanotte"=8 scene. Ogni scena 2-4 frasi (meno per i piccoli).

IMMAGINI: per OGNI scena scegli UN "img" coerente col testo, SOLO da: ${OGGETTI.join(", ")}. Oppure "protagonista" per mostrare il personaggio. Se la scena parla di qualcosa NON in lista, NON inventare: usa l'oggetto piu vicino, oppure "protagonista".

SFONDI: per OGNI scena scegli UNO "sfondo" coerente con DOVE accade, SOLO da: ${SFONDI.join(", ")} (in casa -> cameretta; cielo/sera/stelle -> notte o nuvole; in paese -> citta; tra alberi/prato -> bosco; acqua -> mare).

OUTPUT: SOLO un JSON valido, senza testo intorno, senza markdown:
{"titolo":"...","scene":[{"testo":"...","img":"...","sfondo":"..."}]}`;

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
  try {
    const { chi = "lalla", nome = "", cosa = "una cosa", atmosfera = "dolce", eta = "4-5 anni", lunghezza = "media" } = req.body || {};
    const NOMI = {lalla:"Lalla",tobia:"Tobia",nuvola:"Donna Nuvola",prof:"Professor Quandomai",mimi:"Mimì",nino:"Nino"};
    const protagonista = chi === "bimbo" ? (nome || "il bambino") : (NOMI[chi] || "il bambino");

    const userMsg = `Inventa una favola con questi ingredienti:
- protagonista: ${protagonista}
- una cosa di ogni giorno: ${cosa}
- atmosfera: ${atmosfera}
- eta: ${eta}
- lunghezza: ${lunghezza}
Ricorda: solo JSON, niente altro.`;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 2000, system: SYSTEM, messages: [{ role: "user", content: userMsg }] })
    });
    if (!r.ok) { const t = await r.text(); res.status(500).json({ error: "AI error", detail: t }); return; }
    const data = await r.json();
    let txt = (data.content || []).map(b => b.text || "").join("").trim();
    txt = txt.replace(/^```json\s*/i, "").replace(/^```\s*/, "").replace(/```\s*$/, "").trim();
    let favola;
    try { favola = JSON.parse(txt); } catch (e) { res.status(500).json({ error: "parse", raw: txt }); return; }
    const okImg = new Set([...OGGETTI, "protagonista"]);
    const okSf = new Set(SFONDI);
    (favola.scene || []).forEach(s => { if (!okImg.has(s.img)) s.img = "protagonista"; if (!okSf.has(s.sfondo)) s.sfondo = "notte"; });
    favola.chi = chi;
    res.status(200).json(favola);
  } catch (err) { res.status(500).json({ error: "server", detail: String(err) }); }
}
