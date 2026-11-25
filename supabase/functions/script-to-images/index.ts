import JSZip from "npm:jszip@3.10.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://yrrolin.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function cleanName(value: string, fallback = "image") {
  return (value || fallback).replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_").replace(/\s+/g, " ").slice(0, 100) || fallback;
}

function words(value: string) {
  return new Set((value.toLowerCase().match(/[a-z0-9]{3,}/g) || []).filter((w) =>
    !["the", "and", "for", "with", "from", "that", "this", "into", "your", "are", "was", "were", "will", "have", "has"].includes(w)
  ));
}

function quality(width: number, height: number) {
  return width >= 1920 && height >= 1080 || height >= 1920 && width >= 1080;
}

function scoreAsset(name: string, description: string, query: string) {
  const terms = words(query);
  const haystack = words(name + " " + description);
  let score = 0;
  for (const term of terms) if (haystack.has(term)) score += 1;
  return score;
}

const SCENE_PROMPT = (script: string) => \`Break this video script into a maximum of 6 visual scenes for an editor sourcing still images. Keep scenes in script order. Each scene must have a concise title, a visualBrief describing the exact image needed, and a Google Images searchQuery with concrete visual subjects, locations, objects, lighting and composition. Avoid abstract-only queries. Return JSON only in this shape: {"scenes":[{"id":"scene-1","title":"...","visualBrief":"...","searchQuery":"..."}]}. Script:\n\n\${script}\`;

function parseSceneResponse(raw: string) {
  const cleaned = raw.trim().replace(/^\`\`\`(?:json)?\s*/i, "").replace(/\s*\`\`\`$/, "");
  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed.scenes)) throw new Error("The AI returned an invalid scene breakdown.");
  const scenes = parsed.scenes.slice(0, 6).map((scene: Record<string, unknown>, index: number) => ({
    id: "scene-" + (index + 1),
    title: String(scene.title || "Scene " + (index + 1)).slice(0, 120),
    visualBrief: String(scene.visualBrief || "").slice(0, 500),
    searchQuery: String(scene.searchQuery || scene.visualBrief || scene.title || "").slice(0, 250),
  }));
  if (!scenes.length) throw new Error("The AI could not extract any scenes from this script.");
  return scenes;
}

async function parseWithGemini(script: string, apiKey: string) {
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=" + encodeURIComponent(apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: SCENE_PROMPT(script) }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.25 },
    }),
    signal: AbortSignal.timeout(25000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("Gemini (" + response.status + "): " + (data.error?.message || "Request failed."));
  const raw = data.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("") || "";
  return parseSceneResponse(raw);
}

async function parseWithGroq(script: string, apiKey: string) {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
    body: JSON.stringify({
      model: "openai/gpt-oss-20b",
      messages: [
        { role: "system", content: "You are a video editor's visual research assistant. Return valid JSON only with a scenes array. Each scene must have title, visualBrief, and searchQuery. Maximum 6 scenes." },
        { role: "user", content: SCENE_PROMPT(script) },
      ],
      temperature: 0.25,
      max_completion_tokens: 3000,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(25000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("Groq (" + response.status + "): " + (data.error?.message || "Request failed."));
  const raw = data.choices?.[0]?.message?.content || "";
  return parseSceneResponse(raw);
}

async function parseScript(script: string, geminiKey: string, groqKey: string) {
  let geminiError: Error | null = null;
  if (geminiKey) {
    try {
      return { scenes: await parseWithGemini(script, geminiKey), aiProvider: "Gemini 3.8 Flash" };
    } catch (error) {
      geminiError = error instanceof Error ? error : new Error("Gemini request failed.");
    }
  }
  if (groqKey) {
    try {
      const scenes = await parseWithGroq(script, groqKey);
      return {
        scenes,
        aiProvider: "Groq GPT-OSS 20B",
        fallbackReason: geminiError?.message || "Gemini is not configured; backup model used.",
      };
    } catch (error) {
      const groqError = error instanceof Error ? error.message : "Groq request failed.";
      throw new Error((geminiError ? geminiError.message + " Backup also failed: " : "Backup model failed: ") + groqError);
    }
  }
  if (geminiError) throw geminiError;
  throw new Error("No AI provider is configured. Add GEMINI_API_KEY or GROQ_API_KEY to Supabase Edge Function secrets.");
}
async function listLibraryImages(token: string, folderId: string) {
  const files: Record<string, unknown>[] = [];
  let pageToken = "";
  do {
    const params = new URLSearchParams({
      q: "'" + folderId + "' in parents and trashed = false and mimeType contains 'image/'",
      pageSize: "1000",
      orderBy: "modifiedTime desc",
      fields: "nextPageToken,files(id,name,mimeType,size,webViewLink,thumbnailLink,description,imageMediaMetadata)",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const response = await fetch("https://www.googleapis.com/drive/v3/files?" + params.toString(), {
      headers: { Authorization: "Bearer " + token },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error?.message || "Could not read your Drive image folder.");
    files.push(...(data.files || []));
    pageToken = data.nextPageToken || "";
  } while (pageToken && files.length < 5000);
  return files.map((file) => {
    const meta = (file.imageMediaMetadata || {}) as Record<string, unknown>;
    return {
      id: String(file.id),
      name: String(file.name || "Untitled image"),
      mimeType: String(file.mimeType || "image/jpeg"),
      width: Number(meta.width || 0),
      height: Number(meta.height || 0),
      thumbnailUrl: String(file.thumbnailLink || "https://drive.google.com/thumbnail?id=" + encodeURIComponent(String(file.id)) + "&sz=w800"),
      sourceUrl: String(file.webViewLink || "https://drive.google.com/file/d/" + file.id + "/view"),
      sourceType: "drive",
      sourceName: "Your Drive",
      description: String(file.description || ""),
    };
  }).filter((file) => quality(file.width, file.height));
}

async function googleImages(query: string, apiKey: string, size: string) {
  const params = new URLSearchParams({ engine: "google_images", q: query, api_key: apiKey, google_domain: "google.com", gl: "in", hl: "en", imgsz: size, safe: "active" });
  const response = await fetch("https://serpapi.com/search.json?" + params.toString());
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.error) throw new Error(data.error || "Google Images search failed.");
  return (data.images_results || []).map((item: Record<string, unknown>, index: number) => ({
    selectionId: "google-" + crypto.randomUUID(),
    title: String(item.title || "Image result"),
    thumbnailUrl: String(item.thumbnail || ""),
    originalUrl: String(item.original || ""),
    sourceUrl: String(item.link || ""),
    sourceName: String(item.source || "Google Images"),
    sourceType: "google",
    width: Number(item.original_width || 0),
    height: Number(item.original_height || 0),
    position: Number(item.position || index + 1),
  })).filter((image: Record<string, unknown>) => typeof image.originalUrl === "string" && String(image.originalUrl).startsWith("https://") && quality(Number(image.width), Number(image.height)) && String(image.thumbnailUrl).startsWith("https://"));
}

async function handleSearch(body: Record<string, unknown>, token: string, geminiKey: string, groqKey: string, serpKey: string) {
  const script = String(body.script || "").trim();
  const folderId = String(body.imageFolderId || "");
  if (!script || script.length > 12000) throw new Error("Paste a script between 1 and 12,000 characters.");
  if (!folderId) throw new Error("The Editing Assets / Images & Graphics folder is missing.");
  const ai = await parseScript(script, geminiKey, groqKey);
  const scenes = ai.scenes;
  const library = await listLibraryImages(token, folderId);
  const results = [];
  for (const scene of scenes) {
    const local = library.map((asset) => ({
      ...asset,
      selectionId: "drive-" + asset.id,
      title: asset.name,
      originalUrl: "",
      score: scoreAsset(asset.name, asset.description, scene.searchQuery + " " + scene.visualBrief),
    })).filter((asset) => asset.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);
    let external: Record<string, unknown>[] = [];
    if (local.length < 3) {
      try {
        external = await googleImages(scene.searchQuery, serpKey, "4mp");
        if (external.length < 3) {
          const fallback = await googleImages(scene.searchQuery, serpKey, "2mp");
          const seen = new Set(external.map((item) => item.originalUrl));
          external.push(...fallback.filter((item) => !seen.has(item.originalUrl)).slice(0, 8 - external.length));
        }
      } catch (error) {
        if (!local.length) throw error;
      }
    }
    results.push({
      ...scene,
      images: [...local, ...external].slice(0, 10).map(({ score: _score, description: _description, ...image }) => image),
    });
  }
  return { scenes: results, aiProvider: ai.aiProvider, fallbackReason: ai.fallbackReason || null, qualityTarget: "1920x1080 minimum; 2K/4K preferred", libraryImageCount: library.length };
}

function safeRemoteUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Only secure public image URLs can be downloaded.");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host === "127.0.0.1" || host === "::1" || /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host)) throw new Error("This image URL is not allowed.");
  return url.toString();
}

async function handleDownload(body: Record<string, unknown>, token: string) {
  const selected = Array.isArray(body.selected) ? body.selected as Record<string, unknown>[] : [];
  if (!selected.length || selected.length > 20) throw new Error("Select between 1 and 20 images for one ZIP.");
  const zip = new JSZip();
  const sources = ["TreasureVault image pack", "Images are grouped by script scene.", "", "Source links are provided for reference; image reuse permissions vary by source.", ""];
  let totalBytes = 0;
  for (let index = 0; index < selected.length; index++) {
    const item = selected[index];
    const scene = cleanName(String(item.sceneTitle || "Selected Images"), "Selected Images");
    const title = cleanName(String(item.title || "image-" + (index + 1)));
    let response: Response;
    if (String(item.sourceType) === "drive" && item.driveFileId) {
      response = await fetch("https://www.googleapis.com/drive/v3/files/" + encodeURIComponent(String(item.driveFileId)) + "?alt=media", { headers: { Authorization: "Bearer " + token } });
    } else {
      response = await fetch(safeRemoteUrl(String(item.originalUrl || "")), { headers: { "User-Agent": "TreasureVault/1.0 image-pack" }, signal: AbortSignal.timeout(20000) });
    }
    if (!response.ok) throw new Error("Could not download \"" + title + "\" (" + response.status + "). Some source websites block automated downloads.");
    const contentType = (response.headers.get("content-type") || "").split(";")[0].toLowerCase();
    if (!contentType.startsWith("image/")) throw new Error("\"" + title + "\" did not return an image file.");
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > 12 * 1024 * 1024) throw new Error("\"" + title + "\" exceeds the 12 MB per-image ZIP limit.");
    totalBytes += buffer.byteLength;
    if (totalBytes > 60 * 1024 * 1024) throw new Error("This ZIP exceeds the 60 MB total limit. Download fewer images.");
    const ext = contentType.split("/")[1]?.replace("jpeg", "jpg").replace(/[^a-z0-9]/g, "") || "img";
    zip.file(scene + "/" + String(index + 1).padStart(2, "0") + "_" + title + "." + ext, new Uint8Array(buffer));
    sources.push(scene + " / " + title);
    sources.push("Source page: " + String(item.sourceUrl || "Not provided"));
    sources.push("Original image: " + (item.sourceType === "drive" ? "Google Drive (your library)" : String(item.originalUrl || "Not provided")));
    sources.push("");
  }
  zip.file("Sources_and_Links.txt", sources.join("\n"));
  const bytes = await zip.generateAsync({ type: "uint8array", compression: "STORE" });
  return new Response(bytes, { status: 200, headers: { ...corsHeaders, "Content-Type": "application/zip", "Content-Disposition": 'attachment; filename="TreasureVault_Script_Images.zip"', "Cache-Control": "no-store" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
  try {
    const origin = req.headers.get("origin") || "";
    if (origin && origin !== "https://yrrolin.github.io" && !origin.startsWith("http://localhost:")) return json({ error: "This TreasureVault origin is not allowed." }, 403);
    const body = await req.json();
    const token = String(body.driveAccessToken || "");
    if (!token) return json({ error: "Connect Google Drive and try again." }, 401);
    const identityResponse = await fetch("https://oauth2.googleapis.com/tokeninfo?access_token=" + encodeURIComponent(token));
    if (!identityResponse.ok) return json({ error: "Your Google Drive session expired. Reconnect Drive and try again." }, 401);
    const action = String(body.action || "search");
    if (action === "download") return await handleDownload(body, token);
    const geminiKey = Deno.env.get("GEMINI_API_KEY") || "";
    const groqKey = Deno.env.get("GROQ_API_KEY") || "";
    const serpKey = Deno.env.get("SERPAPI_API_KEY") || "";
    if (!geminiKey && !groqKey) return json({ error: "Add at least one AI provider secret: GEMINI_API_KEY or GROQ_API_KEY." }, 503);
    if (!serpKey) return json({ error: "Add SERPAPI_API_KEY to your Supabase Edge Function secrets." }, 503);
    return json(await handleSearch(body, token, geminiKey, groqKey, serpKey));
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unexpected Script-to-Images error." }, 400);
  }
});
