import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { ENV } from "./_core/env";

const MAX_SOURCE_BYTES = 1_000_000;
const MAX_SOURCE_TEXT = 18_000;

function encryptionKey() {
  if (!ENV.cookieSecret)
    throw new Error("يلزم ضبط JWT_SECRET قبل حفظ مفاتيح الذكاء الاصطناعي");
  return createHash("sha256").update(ENV.cookieSecret).digest();
}

export function encryptPersonalApiKey(apiKey: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(apiKey, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64"),
    tag.toString("base64"),
    encrypted.toString("base64"),
  ].join(".");
}

export function decryptPersonalApiKey(value: string) {
  const [version, iv, tag, encrypted] = value.split(".");
  if (version !== "v1" || !iv || !tag || !encrypted)
    throw new Error("تعذر قراءة مفتاح الذكاء الاصطناعي المحفوظ");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function isPrivateAddress(address: string) {
  const normalized = address.toLowerCase().replace(/^::ffff:/, "");
  if (normalized === "::1" || normalized === "::" || normalized === "0.0.0.0")
    return true;
  if (isIP(normalized) === 4) {
    const [a, b] = normalized.split(".").map(Number);
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }
  return (
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb")
  );
}

async function assertPublicUrl(value: string) {
  const url = new URL(value);
  if (!(["http:", "https:"] as string[]).includes(url.protocol))
    throw new Error("الرابط يجب أن يبدأ بـ http أو https");
  if (url.username || url.password)
    throw new Error("لا يمكن استخدام رابط يحتوي على بيانات دخول");
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost"))
    throw new Error("لا يمكن قراءة الروابط المحلية");
  const direct = isIP(hostname);
  const addresses = direct
    ? [{ address: hostname }]
    : await lookup(hostname, { all: true });
  if (
    !addresses.length ||
    addresses.some(item => isPrivateAddress(item.address))
  )
    throw new Error("لا يمكن قراءة هذا العنوان");
  return url;
}

async function readLimitedText(response: Response) {
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > MAX_SOURCE_BYTES)
    throw new Error("المصدر أكبر من الحد المسموح للتحليل");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_SOURCE_BYTES) {
      await reader.cancel();
      throw new Error("المصدر أكبر من الحد المسموح للتحليل");
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

function htmlToText(html: string) {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  const description =
    html.match(
      /<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']*)["'][^>]*>/i
    )?.[1] ??
    html.match(
      /<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["'](?:description|og:description)["'][^>]*>/i
    )?.[1] ??
    "";
  const body = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  return `${title}\n${description}\n${body}`
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SOURCE_TEXT);
}

export async function extractPublicSource(urlValue: string) {
  let url = await assertPublicUrl(urlValue);
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(url, {
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "user-agent": "WJH-Idea-Lab/1.0 (+https://wijha.ralmatham.ai)",
          accept: "text/html,text/plain,application/json;q=0.8",
        },
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || redirects === 3)
          throw new Error("تعذر تتبع رابط المصدر");
        url = await assertPublicUrl(new URL(location, url).toString());
        continue;
      }
      if (!response.ok)
        throw new Error(`تعذر قراءة المصدر (${response.status})`);
      const contentType = response.headers.get("content-type") || "";
      if (!/text|json|html/i.test(contentType))
        throw new Error("نوع محتوى الرابط غير قابل للقراءة النصية");
      const raw = await readLimitedText(response);
      const text = /html/i.test(contentType)
        ? htmlToText(raw)
        : raw.slice(0, MAX_SOURCE_TEXT);
      if (!text.trim()) throw new Error("لم نجد نصًا عامًا في الرابط");
      return { finalUrl: url.toString(), text };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("تعذر قراءة المصدر");
}

export async function summarizeWithOpenAi(input: {
  apiKey: string;
  model: string;
  url: string;
  title?: string | null;
  notes?: string | null;
  extractedText?: string | null;
  entityKind: "problem" | "idea" | "source";
}) {
  const content = [
    input.title ? `عنوان المصدر: ${input.title}` : "",
    `الرابط: ${input.url}`,
    input.notes ? `ملاحظات العضو:\n${input.notes}` : "",
    input.extractedText ? `النص المستخرج:\n${input.extractedText}` : "",
  ]
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 24_000);
  if (!content.trim()) throw new Error("لا يوجد محتوى كافٍ للتلخيص");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${input.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content:
            "أنت محلل أبحاث أعمال. لخص بالعربية الفصحى الواضحة، ولا تضف أي معلومة غير موجودة في المصدر. اذكر: الفكرة أو المشكلة الأساسية، الأدلة أو الأمثلة، ما الذي يبقى افتراضًا، وكيف يمكن الاستفادة من المصدر. اجعل النتيجة قصيرة وقابلة للمراجعة البشرية.",
        },
        {
          role: "user",
          content: `نوع السجل: ${input.entityKind}\n\n${content}`,
        },
      ],
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: string } }>;
  };
  if (!response.ok)
    throw new Error(
      payload.error?.message || "رفض مزود الذكاء الاصطناعي الطلب"
    );
  const summary = payload.choices?.[0]?.message?.content?.trim();
  if (!summary) throw new Error("لم يرجع مزود الذكاء الاصطناعي ملخصًا");
  return summary;
}
