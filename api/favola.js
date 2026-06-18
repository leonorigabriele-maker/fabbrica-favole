// api/favola.js — Il "cervello" de La Fabbrica delle Favole
const OGGETTI = ["luna","calzino","bottone","valigia","palloncino","stella","chiave","ombrello","cappello","barattolo","cucchiaio","libro","candela","sveglia","aquilone","cannocchiale","pera","gomitolo","conchiglia","fiocco","semaforo","albero","bicicletta","auto","letto","nuvola","sedia","porta","telefono","fiore"];
const SFONDI = ["notte","cameretta","citta","bosco","nuvole","mare"];
const ADMIN_EMAIL = "leonorigabriele@gmail.com";

const SYSTEM = `Sei il narratore de "La Fabbrica delle Favole". Inventi una favola della buonanotte breve e originale nello spirito di Gianni Rodari: fantasia, nonsenso gentile, ironia, gioco di parole, finali aperti o teneri. Scrivi in italiano semplice e musicale. NON copiare personaggi o storie di Rodari: usa solo il suo metodo.

FORMA NASCOSTA: scegli a caso, SENZA dirlo, una di queste 12 strutture e costruiscici la storia: 1) una collezione che svuota il mondo 2) una cosa che scappa 3) un binomio fantastico 4) un desiderio preso alla lettera 5) il mondo al contrario 6) una cosa che si moltiplica 7) un mestiere impossibile 8) un viaggio dentro una cosa piccola 9) una domanda assurda presa sul serio 10) un mestiere sbagliato 11) una cosa che manca 12) un litigio assurdo che finisce in pace.

PERSONAGGI (indole da rispettare): "il bambino" (col nome dato) curioso, protagonista. Lalla fa domande impossibili. Tobia lascia tutto a metà. Donna Nuvola fa mestieri impossibili. Professor Quandomai inventa oggetti assurdi. Mimì fa tutto al rovescio. Nino di notte sente parlare le cose.

STILE: nonsenso gentile. MAI paura, cattivi veri, violenza, buio spaventoso, tristezza pesante. Tutto rassicurante. NIENTE morale esplicita: al massimo un finale dolce o un buffo "perché" del mondo. Frasi musicali, ripetizioni piacevoli. La "cosa di ogni giorno" indicata è il motore della storia. Il finale concilia il sonno.

ATMOSFERA: "dolce" finale tenero e rassicurante, toni caldi, ritmo cullante, immagini morbide. "buffa" situazioni comiche, personaggi goffi, umorismo leggero, finale che fa sorridere. "avventurosa" missione o scoperta da compiere, piccolo ostacolo superato con ingegno, ritmo più vivace e incalzante, finale soddisfacente — sempre rassicurante, mai spaventoso.

ETA: "2-3 anni" frasi cortissime, parole semplici, molta ripetizione, ritmo cullante. "4-5 anni" frasi medie, piu fantasia e gioco di parole. "6-7 anni" trama piu articolata, ironia piu sveglia, lessico piu ricco.

LUNGHEZZA -> NUMERO DI SCENE: "cortissima"=4 scene, "media"=6 scene, "della buonanotte"=8 scene. Ogni scena 2-4 frasi (meno per i piccoli).

IMMAGINI: per OGNI scena scegli UN "img" coerente col testo, SOLO da: ${OGGETTI.join(", ")}. Oppure scegli la posa del protagonista usando "protagonista_POSA" dove POSA è UNA di: fermo, seduto, sorpreso, cammina, dorme, esulta. Scegli la posa coerente con cosa fa il personaggio in quella scena: se corre/si muove → cammina; se è felice/esulta → esulta; se dorme/è stanco → dorme; se è stupito/scopre qualcosa → sorpreso; se ascolta/riflette seduto → seduto; altrimenti → fermo. Se la scena parla di qualcosa NON in lista oggetti, NON inventare: usa la posa del protagonista.

SFONDI: per OGNI scena scegli UNO "sfondo" coerente con DOVE accade, SOLO da: ${SFONDI.join(", ")} (in casa -> cameretta; cielo/sera/stelle -> notte o nuvole; in paese -> citta; tra alberi/prato -> bosco; acqua -> mare).

OUTPUT: SOLO un JSON valido, senza testo intorno, senza markdown:
{"titolo":"...","scene":[{"testo":"...","img":"...","sfondo":"..."}]}`;

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
  try {
    const { chi = "lalla", nome = "", genere = "bimbo", cosa = "una cosa", atmosfera = "dolce", eta = "4-5 anni", lunghezza = "media" } = req.body || {};

    // controllo lato server: verifica limite per utenti loggati
    const authHeader = req.headers["authorization"];
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
        const { data: { user } } = await sb.auth.getUser(token);
        if (user && user.email !== ADMIN_EMAIL) {
          const oggi = new Date().toISOString().slice(0, 10);
          const { data } = await sb.from("generazioni").select("count").eq("user_id", user.id).eq("data", oggi);
          const n = data && data.length ? parseInt(data[0].count || 0) : 0;
          if (n >= 10) {
            res.status(429).json({ error: "limite_raggiunto" });
            return;
          }
        }
      } catch(e) { /* se fallisce il check, procedi comunque */ }
    }

    const NOMI = {lalla:"Lalla",tobia:"Tobia",nuvola:"Donna Nuvola",prof:"Professor Quandomai",mimi:"Mimì",nino:"Nino"};
    let protagonista;
    if(chi === "bimbo"){
      const articolo = genere === "bimba" ? "la bambina" : "il bambino";
      protagonista = nome ? nome : articolo;
    } else {
      protagonista = NOMI[chi] || "il bambino";
    }

    const userMsg = `Inventa una favola con questi ingredienti:
- protagonista: ${protagonista}${chi==="bimbo" ? " (genere: "+(genere||"bimbo")+")" : ""}
- una cosa di ogni giorno: ${cosa}
- atmosfera: ${atmosfera}
- eta: ${eta}
- lunghezza: ${lunghezza}
Usa pronomi e articoli corretti per il genere del protagonista. Ricorda: solo JSON, niente altro.`;

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
    const VALID_POSES = new Set(["fermo","seduto","sorpreso","cammina","dorme","esulta"]);
    const okImg = new Set([...OGGETTI, "protagonista"]);
    const okSf = new Set(SFONDI);
    (favola.scene || []).forEach(s => {
      if(s.img && s.img.startsWith("protagonista_")){
        const p=s.img.replace("protagonista_","");
        if(!VALID_POSES.has(p)) s.img="protagonista_fermo";
      } else if (!okImg.has(s.img)) { s.img = "protagonista_fermo"; }
      if (!okSf.has(s.sfondo)) s.sfondo = "notte";
    });
    favola.chi = chi;
    res.status(200).json(favola);
  } catch (err) { res.status(500).json({ error: "server", detail: String(err) }); }
}
