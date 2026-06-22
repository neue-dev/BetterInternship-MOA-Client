"use client";

import {
  isBucketSignatureImagePayload,
  parseSignatureImageValue,
  serializeSignatureImageValue,
  type FormValues,
} from "@betterinternship/core/forms";
import { useEffect, useState } from "react";

// ? Lets put this inside an env lol
export const BUCKET_PREFIX = "https://storage.googleapis.com/better-internship-public-bucket/";

export const isBucketUrl = (url: string): boolean =>
  typeof url === "string" && url.startsWith(BUCKET_PREFIX);

export const stripUrlParams = (url: string): string => {
  const qIndex = url.indexOf("?");
  return qIndex > -1 ? url.slice(0, qIndex) : url;
};

type CacheEntry = { signedUrl: string; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<string>>();

const TTL_MS = 28 * 60 * 1000; // 28 min (server signs for 30 min)

const resolveFromServer = async (urls: string[]): Promise<Record<string, string>> => {
  const apiUrl = process.env.NEXT_PUBLIC_API_SERVER_URL || "http://localhost:5500";
  const res = await fetch(`${apiUrl}/api/docs/resolve-url`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ urls }),
  });
  if (!res.ok) return {};
  const data = (await res.json()) as { urls?: Record<string, string> };
  return data.urls ?? {};
};

export const resolveSignedUrl = (url: string): Promise<string> => {
  if (!isBucketUrl(url)) {
    return Promise.resolve(url);
  }

  const baseUrl = stripUrlParams(url);

  const cached = cache.get(baseUrl);
  if (cached && cached.expiresAt > Date.now()) {
    return Promise.resolve(cached.signedUrl);
  }

  const existing = inflight.get(baseUrl);
  if (existing) return existing;

  const promise = resolveFromServer([baseUrl])
    .then((result) => {
      const signedUrl = result[baseUrl] ?? url;
      cache.set(baseUrl, { signedUrl, expiresAt: Date.now() + TTL_MS });
      inflight.delete(baseUrl);
      return signedUrl;
    })
    .catch(() => {
      inflight.delete(baseUrl);
      return url;
    });
  inflight.set(baseUrl, promise);
  return promise;
};

export const resolveSignedUrls = async (urls: string[]): Promise<Record<string, string>> => {
  const now = Date.now();
  const result: Record<string, string> = {};

  const toFetch: string[] = [];
  for (const url of urls) {
    if (!isBucketUrl(url)) {
      result[url] = url;
      continue;
    }
    const baseUrl = stripUrlParams(url);
    const cached = cache.get(baseUrl);
    if (cached && cached.expiresAt > now) {
      result[url] = cached.signedUrl;
    } else {
      toFetch.push(baseUrl);
    }
  }

  if (toFetch.length) {
    const serverResults = await resolveFromServer(toFetch).catch<Record<string, string>>(
      () => ({})
    );
    for (const baseUrl of toFetch) {
      const signed = serverResults[baseUrl] ?? baseUrl;
      cache.set(baseUrl, { signedUrl: signed, expiresAt: now + TTL_MS });
      result[baseUrl] = signed;
    }
  }

  return result;
};

export const useSignedUrl = (url: string) => {
  const [signedUrl, setSignedUrl] = useState(url);
  const [loading, setLoading] = useState(isBucketUrl(url));

  useEffect(() => {
    if (!url) {
      setSignedUrl(url);
      setLoading(false);
      return;
    }
    setLoading(true);
    resolveSignedUrl(url).then((resolved) => {
      setSignedUrl(resolved);
      setLoading(false);
    });
  }, [url]);

  return { url: signedUrl, loading };
};

export const useSignedUrls = (urls: string[]) => {
  const key = urls.join("\0");
  const [resolved, setResolved] = useState<Record<string, string>>(() =>
    Object.fromEntries(urls.map((u) => [u, u]))
  );
  const [loading, setLoading] = useState(() => urls.some(isBucketUrl));

  useEffect(() => {
    if (!urls.length) return;
    setLoading(true);
    resolveSignedUrls(urls).then((result) => {
      setResolved(result);
      setLoading(false);
    });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return { urls: resolved, loading };
};

export const resolveSignatureImageValue = async (value: string): Promise<string> => {
  const parsed = parseSignatureImageValue(value);
  if (!parsed || !isBucketSignatureImagePayload(parsed.image)) {
    return value;
  }
  if (parsed.image.signedUrl) {
    return value;
  }
  const bucketUrl = `${BUCKET_PREFIX}${parsed.image.path}`;
  parsed.image.signedUrl = await resolveSignedUrl(bucketUrl);

  return serializeSignatureImageValue(parsed);
};

export const resolveSignatureImageValues = async (values: FormValues): Promise<FormValues> => {
  const next = { ...values };
  await Promise.all(
    Object.entries(values).map(async ([key, value]) => {
      if (!key.startsWith("__signatureImage:")) return;
      next[key] = await resolveSignatureImageValue(value);
    })
  );
  return next;
};
